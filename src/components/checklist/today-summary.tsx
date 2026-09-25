import { BadgeCheck, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { TodayView } from "@/server/queries/checklist";
import { plural } from "./format";

function progressLine({ todayTotal, todayApproved, todaySubmitted }: TodayView["summary"]): string {
  if (todayTotal === 0) return "Nothing is due today.";
  if (todayApproved === todayTotal) return `All ${todayTotal} done for today. Nice work!`;
  const parts = [`${todayApproved} of ${todayTotal} done`];
  if (todaySubmitted > 0) parts.push(`${todaySubmitted} waiting for review`);
  // No-break space before the dot keeps it on the first line if the text wraps.
  return parts.join("\u00a0· ");
}

/** "Today's progress" card: approved (green) + waiting for review (amber) out of everything due today. */
export function TodaySummary({ summary }: { summary: TodayView["summary"] }) {
  return (
    <Card>
      <CardBody className="space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink-900">Today&apos;s progress</h2>
          {summary.overdueCount > 0 && <Badge tone="red">{summary.overdueCount} overdue</Badge>}
        </div>
        {summary.todayTotal > 0 && (
          <ProgressBar done={summary.todayApproved} pending={summary.todaySubmitted} total={summary.todayTotal} showLabel={false} />
        )}
        <p className="text-sm text-ink-600">{progressLine(summary)}</p>
        {summary.todayTotal > 0 && summary.todayApproved < summary.todayTotal && (
          <p className="text-xs text-ink-500">Checked items count as done once a leader approves them.</p>
        )}
      </CardBody>
    </Card>
  );
}

/** Staff only: a shortcut to the review queue when submissions are waiting. */
export function ReviewQueueLink({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <Link
      href="/manage/review"
      className="flex min-h-12 items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 shadow-sm transition-colors hover:border-amber-300 hover:bg-amber-100"
    >
      <BadgeCheck className="size-5 shrink-0 text-amber-600" aria-hidden />
      <span className="flex-1">{plural(count, "submission")} waiting for your review</span>
      <ChevronRight className="size-4 shrink-0 text-amber-700" aria-hidden />
    </Link>
  );
}
