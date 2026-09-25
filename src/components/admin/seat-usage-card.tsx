import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type { SeatUsage } from "@/server/queries/admin";

/** "Build Leader 2/3 — Alex, Sam", with full (and over-full) seats highlighted. */
export function SeatUsageCard({ seats }: { seats: SeatUsage[] }) {
  return (
    <Card>
      <CardHeader title="Leadership seats" description="Active people in each limited position." />
      <ul className="divide-y divide-ink-100">
        {seats.map((s) => {
          const over = s.filled > s.limit;
          const full = s.filled === s.limit;
          return (
            <li
              key={s.role}
              className={cn("flex items-start justify-between gap-3 px-4 py-3 sm:px-5", over ? "bg-red-50/60" : full && "bg-amber-50/60")}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink-900">{s.label}</p>
                <p className="mt-0.5 text-sm text-ink-500">
                  {s.holders.length === 0
                    ? "Open"
                    : s.holders.map((h, i) => (
                        <span key={h.id}>
                          {i > 0 && ", "}
                          <Link href={`/admin/users/${h.id}`} className="hover:text-brand-700 hover:underline">
                            {h.name}
                          </Link>
                        </span>
                      ))}
                </p>
              </div>
              <Badge tone={over ? "red" : full ? "yellow" : "gray"} className="tabular-nums">
                {s.filled}/{s.limit}
                {over ? " · over" : full ? " · full" : ""}
              </Badge>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
