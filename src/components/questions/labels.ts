// Client-safe display helpers for questions.
import type { Subteam } from "@/generated/prisma/enums";
import { SUBTEAM_LABELS } from "@/lib/constants";

/** Who a question is addressed to: a person, "Build leaders", or "Captain" (whole team). */
export function audienceLabel(recipientName: string | null, subteam: Subteam | null): string {
  if (recipientName) return recipientName;
  return subteam ? `${SUBTEAM_LABELS[subteam]} leaders` : "Captain";
}

export function topicLabel(subteam: Subteam | null): string {
  return subteam ? SUBTEAM_LABELS[subteam] : "Whole team";
}

export type WaitLevel = "fresh" | "waiting" | "late";

/** "Waiting 5 min" / "Waiting 3 h" / "Waiting 2 d", plus how urgent it looks. */
export function waitingLabel(since: Date, now: Date): { label: string; level: WaitLevel } {
  const minutes = Math.max(0, Math.floor((now.getTime() - since.getTime()) / 60_000));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const label =
    minutes < 60 ? `Waiting ${Math.max(1, minutes)} min` : hours < 24 ? `Waiting ${hours} h` : `Waiting ${days} d`;
  const level: WaitLevel = hours < 24 ? "fresh" : days < 3 ? "waiting" : "late";
  return { label, level };
}

export function repliesLabel(count: number): string {
  return count === 1 ? "1 reply" : `${count} replies`;
}
