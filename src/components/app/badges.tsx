import type { AccountStatus, AssignmentStatus, Priority, QuestionStatus, Role, Subteam } from "@/generated/prisma/enums";
import {
  ASSIGNMENT_STATUS_LABELS,
  PRIORITY_LABELS,
  QUESTION_STATUS_LABELS,
  ROLE_LABELS,
  STATUS_LABELS,
  SUBTEAM_LABELS,
} from "@/lib/constants";
import { type DateOnly, daysBetween, relativeDueLabel } from "@/lib/dates";
import { Badge, type BadgeTone } from "../ui/badge";

const roleTone: Record<Role, BadgeTone> = {
  MEMBER: "gray",
  SOFTWARE_LEADER: "blue",
  BUILD_LEADER: "yellow",
  BUSINESS_LEADER: "purple",
  CAPTAIN: "brand",
  MENTOR: "green",
  TEACHER: "green",
};

export function RoleBadge({ role }: { role: Role }) {
  return <Badge tone={roleTone[role]}>{ROLE_LABELS[role]}</Badge>;
}

const subteamTone: Record<Subteam, BadgeTone> = { SOFTWARE: "blue", BUILD: "yellow", BUSINESS: "purple" };

/** Subteam chip; null renders "Whole team". */
export function SubteamBadge({ subteam }: { subteam: Subteam | null }) {
  if (!subteam) return <Badge tone="brand">Whole team</Badge>;
  return <Badge tone={subteamTone[subteam]}>{SUBTEAM_LABELS[subteam]}</Badge>;
}

const accountTone: Record<AccountStatus, BadgeTone> = { PENDING: "yellow", ACTIVE: "green", REJECTED: "red", DISABLED: "gray" };

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  return <Badge tone={accountTone[status]}>{STATUS_LABELS[status]}</Badge>;
}

const assignmentTone: Record<AssignmentStatus, BadgeTone> = { TODO: "gray", SUBMITTED: "yellow", APPROVED: "green", REJECTED: "red" };

export function AssignmentStatusBadge({ status }: { status: AssignmentStatus }) {
  return <Badge tone={assignmentTone[status]}>{ASSIGNMENT_STATUS_LABELS[status]}</Badge>;
}

const questionTone: Record<QuestionStatus, BadgeTone> = { OPEN: "yellow", ANSWERED: "blue", RESOLVED: "green" };

export function QuestionStatusBadge({ status }: { status: QuestionStatus }) {
  return <Badge tone={questionTone[status]}>{QUESTION_STATUS_LABELS[status]}</Badge>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  if (priority === "NORMAL") return null;
  return <Badge tone={priority === "HIGH" ? "red" : "gray"}>{PRIORITY_LABELS[priority]} priority</Badge>;
}

/** "Due today" / "Due in 3 days" / "Overdue · 2 days ago"… red when overdue and still open. */
export function DueBadge({ due, today, done = false }: { due: DateOnly; today: DateOnly; done?: boolean }) {
  const diff = daysBetween(today, due);
  const label = relativeDueLabel(due, today);
  if (!done && diff < 0) return <Badge tone="red">Overdue · {label}</Badge>;
  const text = /^(Today|Tomorrow|Yesterday|In )/.test(label) ? `Due ${label.charAt(0).toLowerCase()}${label.slice(1)}` : `Due ${label}`;
  return <Badge tone={!done && diff === 0 ? "brand" : "gray"}>{text}</Badge>;
}
