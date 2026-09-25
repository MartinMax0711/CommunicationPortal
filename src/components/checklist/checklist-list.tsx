import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { DateOnly } from "@/lib/dates";
import type { ChecklistItemData } from "@/server/queries/checklist";
import { ChecklistItem } from "./checklist-item";
import { dayGroupLabel, groupByDueDate } from "./format";

/** A plain stack of checklist items. */
export function ChecklistList({
  items,
  today,
  now,
  timeZone,
  showDue = true,
}: {
  items: ChecklistItemData[];
  today: DateOnly;
  now: string;
  /** Team timezone (pages pass env.teamTimezone). */
  timeZone?: string;
  showDue?: boolean;
}) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.assignmentId}>
          <ChecklistItem item={item} today={today} now={now} timeZone={timeZone} showDue={showDue} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Items grouped under a small heading per due date ("Tomorrow · Fri, Sep 25"). Expects items sorted by due date.
 * Past days keep the per-item due badge so overdue items still stand out in red.
 */
export function DueGroupedList({
  items,
  today,
  now,
  timeZone,
}: {
  items: ChecklistItemData[];
  today: DateOnly;
  now: string;
  timeZone?: string;
}) {
  return (
    <div className="space-y-4">
      {groupByDueDate(items).map((group) => (
        <div key={group.due}>
          <h3 className="mb-1.5 text-xs font-medium text-ink-500">{dayGroupLabel(group.due, today)}</h3>
          <ChecklistList items={group.items} today={today} now={now} timeZone={timeZone} showDue={group.due < today} />
        </div>
      ))}
    </div>
  );
}

const sectionTones = {
  default: { heading: "text-ink-700", icon: "text-ink-400", count: "bg-ink-100 text-ink-600" },
  danger: { heading: "text-red-700", icon: "text-red-500", count: "bg-red-100 text-red-700" },
  warning: { heading: "text-amber-800", icon: "text-amber-500", count: "bg-amber-100 text-amber-800" },
  brand: { heading: "text-brand-800", icon: "text-brand-500", count: "bg-brand-100 text-brand-800" },
} as const;

/** A titled section of the Today page. */
export function ChecklistSection({
  id,
  title,
  count,
  description,
  icon: Icon,
  tone = "default",
  children,
}: {
  id: string;
  title: string;
  count: number;
  description?: ReactNode;
  icon?: LucideIcon;
  tone?: keyof typeof sectionTones;
  children: ReactNode;
}) {
  const t = sectionTones[tone];
  return (
    <section aria-labelledby={id}>
      <div className="mb-2">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={cn("size-4", t.icon)} aria-hidden />}
          <h2 id={id} className={cn("text-sm font-semibold uppercase tracking-wide", t.heading)}>
            {title}
          </h2>
          <span className={cn("rounded-full px-2 text-xs font-semibold leading-5 tabular-nums", t.count)}>{count}</span>
        </div>
        {description && <p className="mt-0.5 text-xs text-ink-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}
