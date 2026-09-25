// Pure permission rules — the single source of truth for "who can do what".
// Services MUST call these (UI hiding a button is not a security boundary).
// Mirrored as Prisma where-clauses in ./scopes.ts for list queries.

import type { AccountStatus, Role, Subteam } from "@/generated/prisma/enums";
import { ALL_SCOPE_ROLES, LEADER_ROLE_SUBTEAM, STAFF_ROLES, isSubteamLeaderRole } from "@/lib/constants";
import type { Actor } from "./actor";

type ActorLike = Pick<Actor, "id" | "role" | "subteam" | "isAdmin">;

/** Leaders, captain, mentors, teachers, and admins. Can assign tasks, review, answer questions. */
export function isStaff(actor: ActorLike): boolean {
  return actor.isAdmin || STAFF_ROLES.includes(actor.role);
}

/** Captain, mentors, teachers, and admins see and manage every subteam. */
export function hasAllScope(actor: ActorLike): boolean {
  return actor.isAdmin || ALL_SCOPE_ROLES.includes(actor.role);
}

/** The subteam a subteam leader leads, else null. */
export function ledSubteam(actor: ActorLike): Subteam | null {
  return isSubteamLeaderRole(actor.role) ? LEADER_ROLE_SUBTEAM[actor.role] : null;
}

/** Can manage tasks/people of `subteam` (null = whole-team, all-scope only). */
export function canManageSubteam(actor: ActorLike, subteam: Subteam | null): boolean {
  if (hasAllScope(actor)) return true;
  const led = ledSubteam(actor);
  return led !== null && subteam === led;
}

/** Can create a task that belongs to `subteam`. */
export function canCreateTask(actor: ActorLike, subteam: Subteam | null): boolean {
  return canManageSubteam(actor, subteam);
}

/**
 * Can assign a task to this person.
 * All-scope staff: any ACTIVE user. Subteam leaders: ACTIVE users in their own subteam.
 */
export function canAssignTo(
  actor: ActorLike,
  assignee: { subteam: Subteam | null; status: AccountStatus },
): boolean {
  if (assignee.status !== "ACTIVE") return false;
  if (hasAllScope(actor)) return true;
  const led = ledSubteam(actor);
  return led !== null && assignee.subteam === led;
}

/** Edit/delete a task, see its progress, review its submissions. */
export function canManageTask(actor: ActorLike, task: { createdById: string; subteam: Subteam | null }): boolean {
  if (!isStaff(actor)) return false;
  return task.createdById === actor.id || canManageSubteam(actor, task.subteam);
}

/** See a task: managers, plus anyone it is assigned to. */
export function canViewTask(
  actor: ActorLike,
  task: { createdById: string; subteam: Subteam | null },
  assigneeIds: readonly string[],
): boolean {
  return canManageTask(actor, task) || assigneeIds.includes(actor.id);
}

/**
 * Approve / send back / reopen a checklist item.
 * - Anyone who can manage the task.
 * - Subteam leaders also review their OWN members' items on whole-team tasks
 *   (pass `assigneeSubteam`; without it only the manage rule applies).
 * You can't review your own item unless you are all-scope staff (captain/mentor/teacher/admin).
 */
export function canReviewAssignment(
  actor: ActorLike,
  task: { createdById: string; subteam: Subteam | null },
  assignment: { userId: string; assigneeSubteam?: Subteam | null },
): boolean {
  if (!isStaff(actor)) return false;
  if (assignment.userId === actor.id && !hasAllScope(actor)) return false;
  if (canManageTask(actor, task)) return true;
  const led = ledSubteam(actor);
  return task.subteam === null && led !== null && assignment.assigneeSubteam === led;
}

type QuestionLike = { askerId: string; recipientId: string | null; subteam: Subteam | null };

/** Asker, the addressed recipient, all-scope staff, and leaders of the question's subteam. */
export function canViewQuestion(actor: ActorLike, q: QuestionLike): boolean {
  if (q.askerId === actor.id || q.recipientId === actor.id) return true;
  if (hasAllScope(actor)) return true;
  const led = ledSubteam(actor);
  return led !== null && q.subteam === led;
}

/** Post in the thread: the asker (follow-ups) or staff who can see it (answers). */
export function canReplyToQuestion(actor: ActorLike, q: QuestionLike): boolean {
  if (q.askerId === actor.id) return true;
  return isStaff(actor) && canViewQuestion(actor, q);
}

/** Mark resolved / reopen: the asker or staff who can see it. */
export function canChangeQuestionStatus(actor: ActorLike, q: QuestionLike): boolean {
  return canReplyToQuestion(actor, q);
}

/** A question can be addressed to any ACTIVE staff member (not to yourself). */
export function canBeQuestionRecipient(user: { id: string; role: Role; status: AccountStatus; isAdmin: boolean }): boolean {
  return user.status === "ACTIVE" && (STAFF_ROLES.includes(user.role) || user.isAdmin);
}

/** Approve/reject accounts, change roles, disable users. */
export function canAdminister(actor: ActorLike): boolean {
  return actor.isAdmin;
}

/** Can open the Manage area (dashboard, tasks, review, progress). */
export function canAccessManage(actor: ActorLike): boolean {
  return isStaff(actor);
}

/** Can see the progress of this person (manage-area progress pages). */
export function canViewMemberProgress(actor: ActorLike, member: { id: string; subteam: Subteam | null }): boolean {
  if (member.id === actor.id) return true;
  if (hasAllScope(actor)) return true;
  const led = ledSubteam(actor);
  return led !== null && member.subteam === led;
}
