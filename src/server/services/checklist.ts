// Member side of the checklist: check an item off (submit it for review), uncheck it
// (withdraw before review), and edit the note sent along with a submission.
// Only the assignee may act on their own assignment. Anything else looks like "not found".
// Checking off is throttled per person, because every check-off emails a leader.

import { z } from "zod";
import { LIMITS } from "@/lib/constants";
import { idSchema, optionalText } from "@/lib/validation";
import { parseInput } from "../action";
import type { ServiceContext } from "../context";
import { allowedFrom, nextStatus } from "../domain/assignment";
import { ConflictError, NotFoundError, RateLimitError } from "../errors";
import { consumeRateLimit } from "../rate-limit";

/**
 * Check-offs per person per hour. Each one emails a leader, so this caps how many emails one account
 * can cause (e.g. a scripted check/uncheck loop). A real day's list — even with a few
 * uncheck/re-check corrections — stays far below it.
 */
export const SUBMIT_RATE_LIMIT = { limit: 60, windowMs: 60 * 60 * 1000 } as const;

const submitInput = z.object({
  assignmentId: idSchema,
  note: optionalText("Note", LIMITS.noteMax),
});

const withdrawInput = z.object({
  assignmentId: idSchema,
});

const noteInput = z.object({
  assignmentId: idSchema,
  note: optionalText("Note", LIMITS.noteMax),
});

const NOT_FOUND = "That checklist item no longer exists.";

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

/**
 * Called after a conditional write matched nothing: works out whether the item is missing
 * (or not the actor's — same answer, so we don't leak it) or just in the wrong state.
 */
async function currentOwnStatus(ctx: ServiceContext, assignmentId: string) {
  const row = await ctx.db.taskAssignment.findFirst({
    where: { id: assignmentId, userId: ctx.actor.id },
    select: { status: true },
  });
  if (!row) throw new NotFoundError(NOT_FOUND);
  return row.status;
}

/** Check an item off: TODO | REJECTED -> SUBMITTED, with an optional note. A reviewer is notified (the note goes in the email). */
export async function submitAssignment(ctx: ServiceContext, raw: unknown): Promise<void> {
  const { assignmentId, note } = parseInput(submitInput, asRecord(raw));

  const allowed = await consumeRateLimit(
    ctx.db,
    `submit:${ctx.actor.id}`,
    SUBMIT_RATE_LIMIT.limit,
    SUBMIT_RATE_LIMIT.windowMs,
    ctx.now,
  );
  if (!allowed) {
    throw new RateLimitError("You've checked off a lot of items in the last hour. Please wait a few minutes and try again.");
  }

  const { count } = await ctx.db.taskAssignment.updateMany({
    where: { id: assignmentId, userId: ctx.actor.id, status: { in: allowedFrom("submit") } },
    // reviewNote is kept on purpose so reviewers can see the earlier feedback.
    data: { status: nextStatus("submit"), submittedAt: ctx.now, submissionNote: note ?? null },
  });
  if (count === 0) {
    await currentOwnStatus(ctx, assignmentId);
    throw new ConflictError("This item was already submitted or approved.");
  }

  ctx.notifier.notify({ type: "task.submitted", assignmentId });
}

/** Uncheck an item before a leader reviews it: SUBMITTED -> TODO. */
export async function withdrawAssignment(ctx: ServiceContext, raw: unknown): Promise<void> {
  const { assignmentId } = parseInput(withdrawInput, asRecord(raw));

  const { count } = await ctx.db.taskAssignment.updateMany({
    where: { id: assignmentId, userId: ctx.actor.id, status: { in: allowedFrom("withdraw") } },
    data: { status: nextStatus("withdraw"), submittedAt: null, submissionNote: null },
  });
  if (count === 0) {
    const status = await currentOwnStatus(ctx, assignmentId);
    if (status === "TODO") throw new ConflictError("This item is already unchecked.");
    throw new ConflictError("A leader already reviewed this item.");
  }
}

/** Add, change, or clear (empty string) the note on a submission that is still waiting for review. */
export async function updateSubmissionNote(ctx: ServiceContext, raw: unknown): Promise<void> {
  const { assignmentId, note } = parseInput(noteInput, asRecord(raw));

  const { count } = await ctx.db.taskAssignment.updateMany({
    where: { id: assignmentId, userId: ctx.actor.id, status: "SUBMITTED" },
    data: { submissionNote: note ?? null },
  });
  if (count === 0) {
    await currentOwnStatus(ctx, assignmentId);
    throw new ConflictError("You can only edit the note while the item is waiting for review.");
  }
}
