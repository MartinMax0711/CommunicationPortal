// Task management + review (leader side): create/edit/delete tasks, and approve / send back / reopen
// / remove checklist items. The member side (submit/withdraw) lives in the checklist service.
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import type { Subteam } from "@/generated/prisma/enums";
import { LIMITS } from "@/lib/constants";
import { addDays, dateOnlyToDb, dbToDateOnly, todayInTimezone } from "@/lib/dates";
import { dateOnlySchema, idSchema, optionalText, stringArray, text } from "@/lib/validation";
import { parseInput } from "../action";
import type { Actor } from "../actor";
import type { ServiceContext } from "../context";
import { allowedFrom, nextStatus } from "../domain/assignment";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../errors";
import { canAssignTo, canCreateTask, canManageTask, canReviewAssignment, hasAllScope, isStaff } from "../permissions";
import { reviewQueueWhere } from "../scopes";

/** How far back / ahead a due date may be set (in days, relative to today in the team timezone). */
export const DUE_DATE_MAX_PAST_DAYS = 30;
export const DUE_DATE_MAX_FUTURE_DAYS = 365;
export const MAX_ASSIGNEES = 150;
export const MAX_BULK_APPROVE = 200;

const TASK_NOT_FOUND = "That task no longer exists.";
const ITEM_NOT_FOUND = "That checklist item no longer exists.";
const ALREADY_REVIEWED = "This item was already reviewed or withdrawn. Refresh to see the latest.";
const OWN_ITEM = "You can't review your own checklist item. Ask another leader or the captain.";
const REMOVE_SELF = "You can't remove yourself from a task. Ask another leader or the captain.";

// ---------- input schemas ----------

const subteamField = z
  .preprocess(
    (v) => (v === undefined || v === null ? "" : v),
    z.enum(["", "SOFTWARE", "BUILD", "BUSINESS"], { error: "Pick a subteam." }),
  )
  .transform((v): Subteam | null => (v === "" ? null : v));

const priorityField = z.preprocess(
  (v) => (v === undefined || v === null || v === "" ? "NORMAL" : v),
  z.enum(["LOW", "NORMAL", "HIGH"], { error: "Pick a priority." }),
);

const assigneeIdsField = stringArray
  .transform((ids) => [...new Set(ids)])
  .pipe(
    z
      .array(z.string())
      .min(1, "Pick at least one person.")
      .max(MAX_ASSIGNEES, `You can assign up to ${MAX_ASSIGNEES} people at once.`),
  );

const taskFields = {
  title: text("Title", LIMITS.taskTitleMax),
  description: optionalText("Description", LIMITS.taskDescriptionMax),
  subteam: subteamField,
  dueDate: dateOnlySchema,
  priority: priorityField,
  assigneeIds: assigneeIdsField,
};

const createInput = z.object(taskFields);
const updateInput = z.object({ taskId: idSchema, ...taskFields });
const taskIdInput = z.object({ taskId: idSchema });
const assignmentIdInput = z.object({ assignmentId: idSchema });

const reviewInput = z.object({
  assignmentId: idSchema,
  decision: z.enum(["approve", "reject"], { error: "Pick approve or send back." }),
  note: optionalText("Note", LIMITS.noteMax),
});

const approveManyInput = z.object({
  assignmentIds: stringArray
    .transform((ids) => [...new Set(ids)])
    .pipe(
      z
        .array(z.string())
        .min(1, "Pick at least one submission.")
        .max(MAX_BULK_APPROVE, `You can approve up to ${MAX_BULK_APPROVE} at once.`),
    ),
});

// ---------- helpers ----------

function requireStaff(actor: Actor) {
  if (!isStaff(actor)) throw new ForbiddenError("Only leaders, the captain, mentors, and teachers can manage tasks.");
}

function subteamForbidden(actor: Actor, subteam: Subteam | null): ForbiddenError {
  if (subteam === null && !hasAllScope(actor)) {
    return new ForbiddenError("Only the captain, mentors, and teachers can create whole-team tasks.");
  }
  return new ForbiddenError("You can only create tasks for your own subteam.");
}

function checkDueDate(ctx: ServiceContext, dueDate: string) {
  const today = todayInTimezone(ctx.config.teamTimezone, ctx.now);
  if (dueDate < addDays(today, -DUE_DATE_MAX_PAST_DAYS)) {
    throw new ValidationError("That due date is too far in the past.", {
      dueDate: `Pick a date no more than ${DUE_DATE_MAX_PAST_DAYS} days ago.`,
    });
  }
  if (dueDate > addDays(today, DUE_DATE_MAX_FUTURE_DAYS)) {
    throw new ValidationError("That due date is too far away.", { dueDate: "Pick a date within the next year." });
  }
}

function listNames(names: string[]): string {
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`;
}

/** Every id must be an existing user the actor may assign. Throws ValidationError on assigneeIds otherwise. */
async function assertAssignable(ctx: ServiceContext, userIds: string[]) {
  if (userIds.length === 0) return;
  const users = await ctx.db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, subteam: true, status: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  const missing = userIds.filter((id) => !byId.has(id));
  const inactive = users.filter((u) => u.status !== "ACTIVE").map((u) => u.name);
  const outOfScope = users.filter((u) => u.status === "ACTIVE" && !canAssignTo(ctx.actor, u)).map((u) => u.name);

  const problems: string[] = [];
  if (missing.length) problems.push(missing.length === 1 ? "1 person no longer exists" : `${missing.length} people no longer exist`);
  if (inactive.length) problems.push(`${listNames(inactive)} ${inactive.length === 1 ? "isn't" : "aren't"} active`);
  if (outOfScope.length) {
    problems.push(`${listNames(outOfScope)} ${outOfScope.length === 1 ? "isn't" : "aren't"} in your subteam`);
  }
  if (problems.length) {
    const message = `Can't assign this task: ${problems.join("; ")}.`;
    throw new ValidationError(message, { assigneeIds: message });
  }
}

const assignmentSelect = {
  id: true,
  userId: true,
  status: true,
  user: { select: { subteam: true } },
  task: { select: { id: true, createdById: true, subteam: true } },
} satisfies Prisma.TaskAssignmentSelect;

type LoadedAssignment = Prisma.TaskAssignmentGetPayload<{ select: typeof assignmentSelect }>;

/** Who an item belongs to, in the shape canReviewAssignment needs. */
function reviewTarget(a: Pick<LoadedAssignment, "userId" | "user">) {
  return { userId: a.userId, assigneeSubteam: a.user.subteam };
}

/** Load an assignment with its task and make sure the actor manages that task (else NotFound). */
async function loadManagedAssignment(ctx: ServiceContext, assignmentId: string): Promise<LoadedAssignment> {
  const assignment = await ctx.db.taskAssignment.findUnique({ where: { id: assignmentId }, select: assignmentSelect });
  if (!assignment || !canManageTask(ctx.actor, assignment.task)) throw new NotFoundError(ITEM_NOT_FOUND);
  return assignment;
}

/**
 * Load an assignment the actor may review: they manage its task, or it is one of their own
 * members' items on a whole-team task. Your own item (visible but not reviewable unless you are
 * all-scope) is Forbidden; anything else is NotFound so ids don't leak.
 */
async function loadReviewableAssignment(ctx: ServiceContext, assignmentId: string): Promise<LoadedAssignment> {
  const assignment = await ctx.db.taskAssignment.findUnique({ where: { id: assignmentId }, select: assignmentSelect });
  if (!assignment) throw new NotFoundError(ITEM_NOT_FOUND);
  if (canReviewAssignment(ctx.actor, assignment.task, reviewTarget(assignment))) return assignment;
  if (assignment.userId === ctx.actor.id || canManageTask(ctx.actor, assignment.task)) throw new ForbiddenError(OWN_ITEM);
  throw new NotFoundError(ITEM_NOT_FOUND);
}

/** The task (or someone on the list) vanished between our read and the write. */
function isGoneError(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2025" || e.code === "P2003");
}

// ---------- tasks ----------

/** Create a task and a TODO checklist item for every assignee. */
export async function createTask(ctx: ServiceContext, raw: unknown): Promise<{ id: string }> {
  requireStaff(ctx.actor);
  const data = parseInput(createInput, raw as Record<string, unknown>);
  if (!canCreateTask(ctx.actor, data.subteam)) throw subteamForbidden(ctx.actor, data.subteam);
  checkDueDate(ctx, data.dueDate);
  await assertAssignable(ctx, data.assigneeIds);

  // Nested create = one statement batch in a single transaction.
  const task = await ctx.db.task.create({
    data: {
      title: data.title,
      description: data.description ?? "",
      subteam: data.subteam,
      dueDate: dateOnlyToDb(data.dueDate),
      priority: data.priority,
      createdById: ctx.actor.id,
      assignments: { createMany: { data: data.assigneeIds.map((userId) => ({ userId })) } },
    },
    select: { id: true },
  });

  ctx.notifier.notify({ type: "task.assigned", taskId: task.id, userIds: data.assigneeIds, actorId: ctx.actor.id });
  return { id: task.id };
}

/**
 * Edit a task. `assigneeIds` is the full desired set: new people get a TODO item, people left out
 * lose theirs, everyone else keeps their current status.
 */
export async function updateTask(ctx: ServiceContext, raw: unknown): Promise<void> {
  requireStaff(ctx.actor);
  const data = parseInput(updateInput, raw as Record<string, unknown>);

  const task = await ctx.db.task.findUnique({
    where: { id: data.taskId },
    select: { id: true, createdById: true, subteam: true, dueDate: true, assignments: { select: { userId: true } } },
  });
  if (!task || !canManageTask(ctx.actor, task)) throw new NotFoundError(TASK_NOT_FOUND);
  if (!canCreateTask(ctx.actor, data.subteam)) {
    throw data.subteam === null && !hasAllScope(ctx.actor)
      ? new ForbiddenError("Only the captain, mentors, and teachers can make a task whole-team.")
      : new ForbiddenError("You can only move tasks to your own subteam.");
  }
  // Keeping an old due date is fine (so old tasks stay editable); a new one must be in range.
  if (data.dueDate !== dbToDateOnly(task.dueDate)) checkDueDate(ctx, data.dueDate);

  const current = new Set(task.assignments.map((a) => a.userId));
  // Same rule as removeAssignment: a subteam leader can't take their own item off the list.
  if (!hasAllScope(ctx.actor) && current.has(ctx.actor.id) && !data.assigneeIds.includes(ctx.actor.id)) {
    throw new ValidationError(REMOVE_SELF, { assigneeIds: REMOVE_SELF });
  }
  const added = data.assigneeIds.filter((id) => !current.has(id));
  await assertAssignable(ctx, added);

  try {
    await ctx.db.$transaction([
      ctx.db.task.update({
        where: { id: task.id },
        data: {
          title: data.title,
          description: data.description ?? "",
          subteam: data.subteam,
          dueDate: dateOnlyToDb(data.dueDate),
          priority: data.priority,
        },
        select: { id: true },
      }),
      ctx.db.taskAssignment.deleteMany({ where: { taskId: task.id, userId: { notIn: data.assigneeIds } } }),
      ctx.db.taskAssignment.createMany({
        data: added.map((userId) => ({ taskId: task.id, userId })),
        skipDuplicates: true,
      }),
    ]);
  } catch (e) {
    // Deleted by someone else after we read it (P2025 on update, P2003 on the new items).
    if (isGoneError(e)) throw new NotFoundError(TASK_NOT_FOUND);
    throw e;
  }

  if (added.length) ctx.notifier.notify({ type: "task.assigned", taskId: task.id, userIds: added, actorId: ctx.actor.id });
}

/** Delete a task and every checklist item for it. Linked questions stay (their task link is cleared). */
export async function deleteTask(ctx: ServiceContext, raw: unknown): Promise<void> {
  requireStaff(ctx.actor);
  const { taskId } = parseInput(taskIdInput, raw as Record<string, unknown>);
  const task = await ctx.db.task.findUnique({ where: { id: taskId }, select: { id: true, createdById: true, subteam: true } });
  if (!task || !canManageTask(ctx.actor, task)) throw new NotFoundError(TASK_NOT_FOUND);
  await ctx.db.task.deleteMany({ where: { id: task.id } });
}

// ---------- review ----------

/** Approve or send back one submitted checklist item. Sending back requires a note. */
export async function reviewAssignment(ctx: ServiceContext, raw: unknown): Promise<void> {
  requireStaff(ctx.actor);
  const data = parseInput(reviewInput, raw as Record<string, unknown>);
  const assignment = await loadReviewableAssignment(ctx, data.assignmentId);
  if (data.decision === "reject" && !data.note) {
    throw new ValidationError("Tell them what to change.", { note: "Tell them what to change." });
  }

  const { count } = await ctx.db.taskAssignment.updateMany({
    where: { id: assignment.id, status: { in: allowedFrom(data.decision) } },
    data: {
      status: nextStatus(data.decision),
      reviewedById: ctx.actor.id,
      reviewedAt: ctx.now,
      reviewNote: data.note ?? null,
    },
  });
  if (count === 0) throw new ConflictError(ALREADY_REVIEWED);

  ctx.notifier.notify({ type: "task.reviewed", assignmentId: assignment.id });
}

/** Approve many submissions at once. Items the actor can't review or that aren't waiting are skipped. */
export async function approveMany(ctx: ServiceContext, raw: unknown): Promise<{ approved: number; skipped: number }> {
  requireStaff(ctx.actor);
  const { assignmentIds } = parseInput(approveManyInput, raw as Record<string, unknown>);

  const candidates = await ctx.db.taskAssignment.findMany({
    where: { AND: [{ id: { in: assignmentIds } }, reviewQueueWhere(ctx.actor)] },
    select: { id: true, userId: true, user: { select: { subteam: true } }, task: { select: { createdById: true, subteam: true } } },
  });
  const ids = candidates.filter((a) => canReviewAssignment(ctx.actor, a.task, reviewTarget(a))).map((a) => a.id);

  const approved = ids.length
    ? await ctx.db.taskAssignment.updateManyAndReturn({
        where: { id: { in: ids }, status: { in: allowedFrom("approve") } },
        data: { status: nextStatus("approve"), reviewedById: ctx.actor.id, reviewedAt: ctx.now, reviewNote: null },
        select: { id: true },
      })
    : [];

  for (const a of approved) ctx.notifier.notify({ type: "task.reviewed", assignmentId: a.id });
  return { approved: approved.length, skipped: assignmentIds.length - approved.length };
}

/** Move an approved item back to the member's to-do list. Keeps the last feedback note. No email. */
export async function reopenAssignment(ctx: ServiceContext, raw: unknown): Promise<void> {
  requireStaff(ctx.actor);
  const { assignmentId } = parseInput(assignmentIdInput, raw as Record<string, unknown>);
  const assignment = await loadReviewableAssignment(ctx, assignmentId);

  const { count } = await ctx.db.taskAssignment.updateMany({
    where: { id: assignment.id, status: { in: allowedFrom("reopen") } },
    data: { status: nextStatus("reopen"), reviewedAt: null, reviewedById: null },
  });
  if (count === 0) throw new ConflictError("This item isn't approved anymore. Refresh to see the latest.");
}

/**
 * Take one person off a task (deletes their checklist item). Task managers only — and, like
 * reviewing, a subteam leader can't remove their own item (only all-scope staff can).
 */
export async function removeAssignment(ctx: ServiceContext, raw: unknown): Promise<void> {
  requireStaff(ctx.actor);
  const { assignmentId } = parseInput(assignmentIdInput, raw as Record<string, unknown>);
  const assignment = await loadManagedAssignment(ctx, assignmentId);
  if (assignment.userId === ctx.actor.id && !hasAllScope(ctx.actor)) throw new ForbiddenError(REMOVE_SELF);
  await ctx.db.taskAssignment.deleteMany({ where: { id: assignment.id } });
}
