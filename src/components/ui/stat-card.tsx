import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function StatCard({
  label,
  value,
  icon: Icon,
  href,
  hint,
  tone = "default",
}: {
  label: ReactNode;
  value: ReactNode;
  icon?: LucideIcon;
  href?: string;
  hint?: ReactNode;
  tone?: "default" | "attention";
}) {
  const body = (
    <div
      className={cn(
        "flex h-full items-start justify-between gap-3 rounded-xl border bg-white p-4 shadow-sm transition-colors",
        tone === "attention" ? "border-amber-300" : "border-ink-200",
        href && "hover:border-brand-300 hover:bg-brand-50/40",
      )}
    >
      <div className="min-w-0">
        <p className="text-sm text-ink-500">{label}</p>
        <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-ink-900">{value}</p>
        {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
      </div>
      {Icon && (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <Icon className="size-5" aria-hidden />
        </span>
      )}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}
