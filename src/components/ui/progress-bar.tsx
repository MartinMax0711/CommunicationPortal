import { cn } from "@/lib/cn";

/** Stacked bar: approved (green) + waiting for review (amber) out of total. */
export function ProgressBar({
  done,
  pending = 0,
  total,
  className,
  showLabel = true,
}: {
  done: number;
  pending?: number;
  total: number;
  className?: string;
  showLabel?: boolean;
}) {
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className="flex h-2 flex-1 overflow-hidden rounded-full bg-ink-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label={`${done} of ${total} approved`}
      >
        <div className="bg-brand-500" style={{ width: `${pct(done)}%` }} />
        <div className="bg-amber-400" style={{ width: `${pct(pending)}%` }} />
      </div>
      {showLabel && (
        <span className="w-12 shrink-0 text-right text-xs tabular-nums text-ink-500">
          {done}/{total}
        </span>
      )}
    </div>
  );
}
