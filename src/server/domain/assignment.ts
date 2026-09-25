// The checklist item state machine. Both the member side (submit/withdraw) and the
// leader side (approve/send back/reopen) MUST go through these guards.
//
//   TODO ──submit──▶ SUBMITTED ──approve──▶ APPROVED   (officially done)
//    ▲                 │   │                   │
//    └────withdraw─────┘   └─send back─▶ REJECTED ──submit──▶ SUBMITTED
//    ▲                                                        
//    └──────────────────────reopen (manager)───────────────────┘ (from APPROVED)

import type { AssignmentStatus } from "@/generated/prisma/enums";

export type AssignmentTransition = "submit" | "withdraw" | "approve" | "reject" | "reopen";

const TRANSITIONS: Record<AssignmentTransition, { from: readonly AssignmentStatus[]; to: AssignmentStatus }> = {
  submit: { from: ["TODO", "REJECTED"], to: "SUBMITTED" },
  withdraw: { from: ["SUBMITTED"], to: "TODO" },
  approve: { from: ["SUBMITTED"], to: "APPROVED" },
  reject: { from: ["SUBMITTED"], to: "REJECTED" },
  reopen: { from: ["APPROVED"], to: "TODO" },
};

export function canTransition(from: AssignmentStatus, action: AssignmentTransition): boolean {
  return TRANSITIONS[action].from.includes(from);
}

export function nextStatus(action: AssignmentTransition): AssignmentStatus {
  return TRANSITIONS[action].to;
}

/** Statuses a transition may start from — use in `updateMany({ where: { status: { in } } })` to avoid races. */
export function allowedFrom(action: AssignmentTransition): AssignmentStatus[] {
  return [...TRANSITIONS[action].from];
}

/** Counts as finished for progress bars. */
export function isDone(status: AssignmentStatus): boolean {
  return status === "APPROVED";
}

/** Still on the member's plate (shows in Today / overdue). */
export function isOpenForMember(status: AssignmentStatus): boolean {
  return status === "TODO" || status === "REJECTED";
}
