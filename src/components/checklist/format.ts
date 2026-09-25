// Small, pure display helpers for the checklist pages (client-safe).
import { type DateOnly, dateOnlyToDb, formatDateOnly, relativeDueLabel } from "@/lib/dates";

/** "Good morning" / "Good afternoon" / "Good evening" for the hour it is in `timeZone`. */
export function greetingFor(now: Date, timeZone: string): string {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(now)) % 24;
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

/** First word of a display name ("Alex Chen" -> "Alex"). */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** "Thursday, September 24" for a calendar day. */
export function longDate(value: DateOnly): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" }).format(
    dateOnlyToDb(value),
  );
}

/** Heading for a group of items due on one day: "Tomorrow · Fri, Sep 25", "Wed, Oct 7". */
export function dayGroupLabel(due: DateOnly, today: DateOnly): string {
  const full = formatDateOnly(due, today);
  const rel = relativeDueLabel(due, today);
  return rel === full ? full : `${rel} · ${full}`;
}

/** Split an already-sorted list into consecutive groups that share a due date. */
export function groupByDueDate<T extends { task: { dueDate: DateOnly } }>(items: T[]): { due: DateOnly; items: T[] }[] {
  const groups: { due: DateOnly; items: T[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.due === item.task.dueDate) last.items.push(item);
    else groups.push({ due: item.task.dueDate, items: [item] });
  }
  return groups;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
