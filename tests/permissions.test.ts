import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Actor } from "@/server/actor";
import {
  canAssignTo,
  canManageTask,
  canReviewAssignment,
  canViewMemberProgress,
  canViewQuestion,
  hasAllScope,
  isStaff,
} from "@/server/permissions";
import {
  assignableUsersWhere,
  manageableMembersWhere,
  manageableTasksWhere,
  questionInboxWhere,
  reviewQueueWhere,
  visibleQuestionsWhere,
} from "@/server/scopes";
import { canTransition } from "@/server/domain/assignment";
import { createTestDb, type TestDb } from "./helpers/db";
import { makeTask, makeUser } from "./helpers/factories";

let t: TestDb;
let people: Record<string, Actor>;

beforeAll(async () => {
  t = await createTestDb();
  const db = t.db;
  people = {
    admin: await makeUser(db, { role: "MEMBER", subteam: "BUSINESS", isAdmin: true }),
    captain: await makeUser(db, { role: "CAPTAIN" }),
    mentor: await makeUser(db, { role: "MENTOR" }),
    teacher: await makeUser(db, { role: "TEACHER" }),
    swLead: await makeUser(db, { role: "SOFTWARE_LEADER" }),
    buildLead1: await makeUser(db, { role: "BUILD_LEADER" }),
    buildLead2: await makeUser(db, { role: "BUILD_LEADER" }),
    bizLead: await makeUser(db, { role: "BUSINESS_LEADER" }),
    swMember: await makeUser(db, { role: "MEMBER", subteam: "SOFTWARE" }),
    buildMember: await makeUser(db, { role: "MEMBER", subteam: "BUILD" }),
    bizMember: await makeUser(db, { role: "MEMBER", subteam: "BUSINESS" }),
    pendingLead: await makeUser(db, { role: "BUILD_LEADER", status: "PENDING" }),
    disabledMember: await makeUser(db, { role: "MEMBER", subteam: "BUILD", status: "DISABLED" }),
  };
  const p = people;
  // Tasks across subteams/creators, each with submitted assignments.
  await makeTask(db, p.swLead, { subteam: "SOFTWARE", assigneeIds: [p.swMember.id] });
  await makeTask(db, p.buildLead1, { subteam: "BUILD", assigneeIds: [p.buildMember.id, p.buildLead2.id] });
  await makeTask(db, p.captain, { subteam: null, assigneeIds: [p.swMember.id, p.buildMember.id, p.bizMember.id, p.captain.id] });
  await makeTask(db, p.captain, { subteam: "BUILD", assigneeIds: [p.buildLead1.id] });
  await makeTask(db, p.bizLead, { subteam: "BUSINESS", assigneeIds: [p.bizMember.id, p.bizLead.id] });
  await db.taskAssignment.updateMany({ data: { status: "SUBMITTED" } });

  // Questions with every targeting shape.
  const q = (askerId: string, subteam: Actor["subteam"], recipientId: string | null) =>
    db.question.create({ data: { title: "q", body: "b", askerId, subteam, recipientId } });
  await q(p.swMember.id, "SOFTWARE", null);
  await q(p.buildMember.id, "BUILD", p.buildLead2.id);
  await q(p.bizMember.id, "BUSINESS", p.mentor.id);
  await q(p.buildMember.id, null, null);
  await q(p.swLead.id, null, p.captain.id);
  await q(p.buildLead1.id, "BUILD", null);
});

afterAll(async () => {
  await t?.drop();
});

describe("role classification", () => {
  it("staff and all-scope roles", () => {
    expect(isStaff(people.swMember)).toBe(false);
    expect(isStaff(people.swLead)).toBe(true);
    expect(isStaff(people.admin)).toBe(true); // admin even with MEMBER role
    expect(hasAllScope(people.captain)).toBe(true);
    expect(hasAllScope(people.mentor)).toBe(true);
    expect(hasAllScope(people.teacher)).toBe(true);
    expect(hasAllScope(people.buildLead1)).toBe(false);
  });
});

describe("scopes mirror permission functions", () => {
  it("manageableTasksWhere == canManageTask", async () => {
    const tasks = await t.db.task.findMany();
    for (const actor of Object.values(people)) {
      const viaDb = new Set((await t.db.task.findMany({ where: manageableTasksWhere(actor) })).map((x) => x.id));
      const viaFn = new Set(tasks.filter((task) => canManageTask(actor, task)).map((x) => x.id));
      expect([...viaDb].sort(), `actor ${actor.name}`).toEqual([...viaFn].sort());
    }
  });

  it("reviewQueueWhere == canReviewAssignment on SUBMITTED", async () => {
    const all = await t.db.taskAssignment.findMany({ include: { task: true, user: { select: { subteam: true } } } });
    for (const actor of Object.values(people)) {
      const viaDb = new Set((await t.db.taskAssignment.findMany({ where: reviewQueueWhere(actor) })).map((x) => x.id));
      const viaFn = new Set(
        all
          .filter((a) => a.status === "SUBMITTED" && canReviewAssignment(actor, a.task, { userId: a.userId, assigneeSubteam: a.user.subteam }))
          .map((x) => x.id),
      );
      expect([...viaDb].sort(), `actor ${actor.name}`).toEqual([...viaFn].sort());
    }
  });

  it("subteam leaders review their own members' items on whole-team tasks, not other subteams'", async () => {
    const wholeTeam = { createdById: people.captain.id, subteam: null };
    expect(canReviewAssignment(people.buildLead1, wholeTeam, { userId: people.buildMember.id, assigneeSubteam: "BUILD" })).toBe(true);
    expect(canReviewAssignment(people.buildLead1, wholeTeam, { userId: people.swMember.id, assigneeSubteam: "SOFTWARE" })).toBe(false);
    expect(canReviewAssignment(people.buildLead1, wholeTeam, { userId: people.buildLead1.id, assigneeSubteam: "BUILD" })).toBe(false);
    // Without the assignee's subteam only the manage rule applies (safe default).
    expect(canReviewAssignment(people.buildLead1, wholeTeam, { userId: people.buildMember.id })).toBe(false);
    expect(canReviewAssignment(people.buildMember, wholeTeam, { userId: people.bizMember.id, assigneeSubteam: "BUSINESS" })).toBe(false);
    const queue = await t.db.taskAssignment.findMany({ where: reviewQueueWhere(people.buildLead1), include: { task: true, user: true } });
    expect(queue.some((a) => a.task.subteam === null && a.user.subteam === "BUILD")).toBe(true);
    expect(queue.every((a) => a.task.subteam !== null || a.user.subteam === "BUILD")).toBe(true);
  });

  it("visibleQuestionsWhere == canViewQuestion, inbox excludes own", async () => {
    const all = await t.db.question.findMany();
    for (const actor of Object.values(people)) {
      const viaDb = new Set((await t.db.question.findMany({ where: visibleQuestionsWhere(actor) })).map((x) => x.id));
      const viaFn = new Set(all.filter((q) => canViewQuestion(actor, q)).map((x) => x.id));
      expect([...viaDb].sort(), `actor ${actor.name}`).toEqual([...viaFn].sort());

      const inbox = await t.db.question.findMany({ where: questionInboxWhere(actor) });
      for (const q of inbox) {
        expect(q.askerId).not.toBe(actor.id);
        expect(canViewQuestion(actor, q)).toBe(true);
      }
      if (!isStaff(actor)) expect(inbox).toHaveLength(0);
    }
  });

  it("assignable/manageable members == canAssignTo / canViewMemberProgress", async () => {
    const users = await t.db.user.findMany();
    for (const actor of Object.values(people)) {
      const assignable = new Set((await t.db.user.findMany({ where: assignableUsersWhere(actor) })).map((u) => u.id));
      const expected = new Set(users.filter((u) => isStaff(actor) && canAssignTo(actor, u)).map((u) => u.id));
      expect([...assignable].sort(), `actor ${actor.name}`).toEqual([...expected].sort());

      const visible = new Set((await t.db.user.findMany({ where: manageableMembersWhere(actor) })).map((u) => u.id));
      const expectedVisible = new Set(
        users.filter((u) => isStaff(actor) && u.status === "ACTIVE" && canViewMemberProgress(actor, u)).map((u) => u.id),
      );
      expect([...visible].sort(), `actor ${actor.name}`).toEqual([...expectedVisible].sort());
    }
  });
});

describe("specific rules", () => {
  it("subteam leaders manage only their subteam; whole-team tasks are all-scope only", () => {
    const wholeTeam = { createdById: people.captain.id, subteam: null };
    const build = { createdById: people.captain.id, subteam: "BUILD" as const };
    expect(canManageTask(people.buildLead2, build)).toBe(true);
    expect(canManageTask(people.swLead, build)).toBe(false);
    expect(canManageTask(people.buildLead1, wholeTeam)).toBe(false);
    expect(canManageTask(people.mentor, wholeTeam)).toBe(true);
    expect(canManageTask(people.buildMember, build)).toBe(false);
  });

  it("leaders cannot review their own submission; all-scope staff can", () => {
    const task = { createdById: people.buildLead1.id, subteam: "BUILD" as const };
    expect(canReviewAssignment(people.buildLead1, task, { userId: people.buildLead1.id })).toBe(false);
    expect(canReviewAssignment(people.buildLead2, task, { userId: people.buildLead1.id })).toBe(true);
    expect(canReviewAssignment(people.captain, task, { userId: people.captain.id })).toBe(true);
  });

  it("cannot assign to inactive users or outside own subteam", () => {
    expect(canAssignTo(people.buildLead1, people.buildMember)).toBe(true);
    expect(canAssignTo(people.buildLead1, people.swMember)).toBe(false);
    expect(canAssignTo(people.captain, people.disabledMember)).toBe(false);
    expect(canAssignTo(people.captain, people.pendingLead)).toBe(false);
  });

  it("members only see their own questions", () => {
    const other = { askerId: people.bizMember.id, recipientId: null, subteam: "BUILD" as const };
    expect(canViewQuestion(people.buildMember, other)).toBe(false);
    expect(canViewQuestion(people.buildLead2, other)).toBe(true);
    expect(canViewQuestion(people.swLead, other)).toBe(false);
  });

  it("assignment state machine", () => {
    expect(canTransition("TODO", "submit")).toBe(true);
    expect(canTransition("REJECTED", "submit")).toBe(true);
    expect(canTransition("APPROVED", "submit")).toBe(false);
    expect(canTransition("SUBMITTED", "withdraw")).toBe(true);
    expect(canTransition("TODO", "approve")).toBe(false);
    expect(canTransition("SUBMITTED", "approve")).toBe(true);
    expect(canTransition("SUBMITTED", "reject")).toBe(true);
    expect(canTransition("APPROVED", "reopen")).toBe(true);
    expect(canTransition("SUBMITTED", "reopen")).toBe(false);
  });
});
