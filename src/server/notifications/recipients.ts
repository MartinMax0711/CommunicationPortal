// Who gets an email for each notification event.
//
// Rules (see docs/CONVENTIONS.md → Notifications):
// - Only ACTIVE accounts get preference-based emails; password resets go to anyone except DISABLED.
// - The person who caused the event never gets an email about it.
// - Each person's emailOn* preference is respected (account approval and password reset are always sent).
// - Results are deduped by user id.
//
// No "server-only" / next/* imports: this runs inside after() and in tests.
import type { Prisma } from "@/generated/prisma/client";
import type { AccountStatus, Role, Subteam } from "@/generated/prisma/enums";
import { SUBTEAM_LEADER_ROLE } from "@/lib/constants";
import type { Db } from "../db";
import { canManageTask, canReviewAssignment, canViewQuestion } from "../permissions";

export type NotificationPref =
  | "emailOnQuestion"
  | "emailOnSubmission"
  | "emailOnReply"
  | "emailOnReview"
  | "emailOnAssigned"
  | "emailOnSignup";

/** Everything needed to decide whether (and how) to email someone. */
export const recipientSelect = {
  id: true,
  name: true,
  email: true,
  status: true,
  role: true,
  subteam: true,
  isAdmin: true,
  emailOnQuestion: true,
  emailOnSubmission: true,
  emailOnReply: true,
  emailOnReview: true,
  emailOnAssigned: true,
  emailOnSignup: true,
} as const satisfies Prisma.UserSelect;

export interface Candidate {
  id: string;
  name: string;
  email: string;
  status: AccountStatus;
  role: Role;
  subteam: Subteam | null;
  isAdmin: boolean;
  emailOnQuestion: boolean;
  emailOnSubmission: boolean;
  emailOnReply: boolean;
  emailOnReview: boolean;
  emailOnAssigned: boolean;
  emailOnSignup: boolean;
}

export interface Recipient {
  id: string;
  name: string;
  email: string;
}

interface PickOptions {
  /** Preference that must be on. Omit for emails that are always sent. */
  pref?: NotificationPref;
  /** People who must not get the email (e.g. whoever caused the event). */
  exclude?: ReadonlyArray<string | null | undefined>;
  /** Which account statuses may receive it. Default: ACTIVE only. */
  statuses?: readonly AccountStatus[];
}

/** Filter candidates by status, exclusions, and preference, and dedupe by id. */
export function pickRecipients(candidates: ReadonlyArray<Candidate | null | undefined>, opts: PickOptions = {}): Recipient[] {
  const statuses = opts.statuses ?? ["ACTIVE"];
  const excluded = new Set(opts.exclude?.filter((id): id is string => !!id));
  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const c of candidates) {
    if (!c || seen.has(c.id) || excluded.has(c.id)) continue;
    if (!statuses.includes(c.status)) continue;
    if (opts.pref && !c[opts.pref]) continue;
    if (!c.email) continue;
    seen.add(c.id);
    out.push({ id: c.id, name: c.name, email: c.email });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------------------------

export interface QuestionTarget {
  askerId: string;
  recipientId: string | null;
  subteam: Subteam | null;
}

interface StaffTierOptions {
  /** Tier 1 (optional): one specific person, e.g. the question's addressee. */
  personId?: string | null;
  /** Tier 2 (optional): everyone holding this subteam-leader role. */
  leaderRole: Role | null;
  /** Removed before the tiers are checked (e.g. whoever caused the event). */
  excludeIds: readonly string[];
  /** Extra rule every candidate must pass (e.g. "can review this item"). */
  eligible?: (u: Candidate) => boolean;
}

/**
 * The first non-empty tier of ACTIVE staff: the given person → holders of `leaderRole` →
 * captains → admins. Tiers are chosen before preferences, so someone who turned an email off
 * doesn't push it onto the next tier.
 */
async function firstStaffTier(db: Db, opts: StaffTierOptions): Promise<Candidate[]> {
  const or: Prisma.UserWhereInput[] = [{ role: "CAPTAIN" }, { isAdmin: true }];
  if (opts.personId) or.push({ id: opts.personId });
  if (opts.leaderRole) or.push({ role: opts.leaderRole });

  // One query for every tier; pick the first non-empty tier in memory.
  const found = await db.user.findMany({
    where: { status: "ACTIVE", id: { notIn: [...opts.excludeIds] }, OR: or },
    select: recipientSelect,
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  const users = opts.eligible ? found.filter(opts.eligible) : found;

  const tiers: Array<(u: Candidate) => boolean> = [];
  if (opts.personId) tiers.push((u) => u.id === opts.personId);
  if (opts.leaderRole) tiers.push((u) => u.role === opts.leaderRole);
  tiers.push((u) => u.role === "CAPTAIN");
  tiers.push((u) => u.isAdmin);
  for (const inTier of tiers) {
    const set = users.filter(inTier);
    if (set.length > 0) return set;
  }
  return [];
}

/**
 * The staff responsible for a question, before preferences: the addressed person; else the
 * subteam's leaders (or captains for whole-team questions); falling back to captains, then admins,
 * when nobody ACTIVE holds that seat yet. `excludeIds` (e.g. the asker) are removed before the
 * fallback check, so a leader asking their own subteam still reaches someone.
 */
export function questionStaffCandidates(
  db: Db,
  q: Pick<QuestionTarget, "recipientId" | "subteam">,
  excludeIds: readonly string[],
): Promise<Candidate[]> {
  return firstStaffTier(db, {
    personId: q.recipientId,
    leaderRole: q.subteam ? SUBTEAM_LEADER_ROLE[q.subteam] : null,
    excludeIds,
  });
}

/** question.asked → the responsible staff (emailOnQuestion), never the asker. */
export async function questionAskedRecipients(db: Db, q: QuestionTarget): Promise<Recipient[]> {
  const staff = await questionStaffCandidates(db, q, [q.askerId]);
  return pickRecipients(staff, { pref: "emailOnQuestion", exclude: [q.askerId] });
}

export interface QuestionRepliedResult {
  /** "asker": someone else replied, so the asker is told. "staff": the asker followed up. */
  audience: "asker" | "staff";
  recipients: Recipient[];
}

/**
 * question.replied.
 * - The asker followed up → the responsible staff plus every staff member who already replied
 *   in the thread and can still see it (emailOnQuestion).
 * - Anyone else replied → the asker (emailOnReply).
 * The reply's author is always excluded.
 */
export async function questionRepliedRecipients(
  db: Db,
  q: QuestionTarget & { id: string; asker: Candidate },
  reply: { id: string; authorId: string; createdAt: Date },
): Promise<QuestionRepliedResult> {
  if (reply.authorId !== q.askerId) {
    return {
      audience: "asker",
      recipients: pickRecipients([q.asker], { pref: "emailOnReply", exclude: [reply.authorId] }),
    };
  }

  const exclude = [q.askerId, reply.authorId];
  const [staff, earlierRepliers] = await Promise.all([
    questionStaffCandidates(db, q, exclude),
    db.user.findMany({
      where: {
        status: "ACTIVE",
        id: { notIn: exclude },
        questionReplies: { some: { questionId: q.id, id: { not: reply.id }, createdAt: { lte: reply.createdAt } } },
      },
      select: recipientSelect,
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
  ]);
  // Someone who replied earlier but has since lost access (e.g. stepped down) must not get the thread.
  const repliers = earlierRepliers.filter((u) => canViewQuestion(u, q));
  return {
    audience: "staff",
    recipients: pickRecipients([...staff, ...repliers], { pref: "emailOnQuestion", exclude }),
  };
}

// ---------------------------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------------------------

export interface SubmissionRecipient extends Recipient {
  /**
   * Can open the task's manage page. False for a subteam leader reviewing their own member's item
   * on a whole-team task: they review it from the Review queue instead.
   */
  canManageTask: boolean;
}

/**
 * task.submitted → who should review it (emailOnSubmission); never the submitter.
 * - The task's creator, if they are ACTIVE, not the submitter, and can still review this item.
 *   Nobody else is emailed then (three build leaders don't all need every check-off).
 * - Otherwise (creator disabled, stepped down, lost scope, or submitted it themselves) the first
 *   non-empty tier of ACTIVE people who can review it: leaders of the task's subteam (for a
 *   whole-team task, of the submitter's subteam) → captains → admins.
 * - Exception: when the creator submitted their own item and may approve it themselves
 *   (all-scope), nobody needs telling.
 */
export async function taskSubmittedRecipients(
  db: Db,
  a: {
    userId: string;
    user: { subteam: Subteam | null };
    task: { createdById: string; subteam: Subteam | null; createdBy: Candidate };
  },
): Promise<SubmissionRecipient[]> {
  const { task, userId } = a;
  const item = { userId, assigneeSubteam: a.user.subteam };
  const withManage = (people: Candidate[]): SubmissionRecipient[] =>
    pickRecipients(people, { pref: "emailOnSubmission", exclude: [userId] }).map((r) => {
      const person = people.find((u) => u.id === r.id);
      return { ...r, canManageTask: !!person && canManageTask(person, task) };
    });

  const creator = task.createdBy;
  if (creator.id === userId) {
    // They can approve their own item (all-scope staff): nothing to tell anyone.
    if (creator.status === "ACTIVE" && canReviewAssignment(creator, task, item)) return [];
  } else if (creator.status === "ACTIVE" && canReviewAssignment(creator, task, item)) {
    // The creator decides; respect their preference and don't spread it to other leaders.
    return withManage([creator]);
  }

  const reviewSubteam = task.subteam ?? a.user.subteam;
  const reviewers = await firstStaffTier(db, {
    leaderRole: reviewSubteam ? SUBTEAM_LEADER_ROLE[reviewSubteam] : null,
    excludeIds: [userId],
    eligible: (u) => canReviewAssignment(u, task, item),
  });
  return withManage(reviewers);
}

/** task.reviewed → the assignee (emailOnReview), unless they reviewed it themselves. */
export function taskReviewedRecipients(a: { reviewedById: string | null; user: Candidate }): Recipient[] {
  return pickRecipients([a.user], { pref: "emailOnReview", exclude: [a.reviewedById] });
}

/**
 * task.assigned → the listed users who really hold an assignment for the task (emailOnAssigned,
 * off by default), minus whoever made the change (`actorId`; the task's creator when unknown).
 * A creator added to their own task by someone else is told like anyone else.
 */
export async function taskAssignedRecipients(
  db: Db,
  task: { id: string; createdById: string },
  userIds: readonly string[],
  actorId?: string | null,
): Promise<Recipient[]> {
  const changedBy = actorId ?? task.createdById;
  const ids = [...new Set(userIds)].filter((id) => id !== changedBy);
  if (ids.length === 0) return [];
  const users = await db.user.findMany({
    where: {
      id: { in: ids },
      status: "ACTIVE",
      emailOnAssigned: true,
      assignments: { some: { taskId: task.id } },
    },
    select: recipientSelect,
    orderBy: { name: "asc" },
    take: 500,
  });
  return pickRecipients(users, { pref: "emailOnAssigned", exclude: [changedBy] });
}

// ---------------------------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------------------------

/** account.pending → every ACTIVE admin (emailOnSignup), never the new user. */
export async function accountPendingRecipients(db: Db, newUserId: string): Promise<Recipient[]> {
  const admins = await db.user.findMany({
    where: { isAdmin: true, status: "ACTIVE", emailOnSignup: true, id: { not: newUserId } },
    select: recipientSelect,
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  return pickRecipients(admins, { pref: "emailOnSignup", exclude: [newUserId] });
}

/** account.approved → that user (always sent; no preference). */
export function accountApprovedRecipients(user: Candidate): Recipient[] {
  return pickRecipients([user]);
}

/** password.reset → that user unless DISABLED (always sent; no preference). */
export function passwordResetRecipients(user: Candidate): Recipient[] {
  return pickRecipients([user], { statuses: ["PENDING", "ACTIVE", "REJECTED"] });
}
