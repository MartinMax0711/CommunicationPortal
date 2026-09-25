import Link from "next/link";
import { cn } from "@/lib/cn";
import { CountBubble } from "./badge";

export interface LinkTab {
  href: string;
  label: string;
  active: boolean;
  count?: number;
  /** "alert" = green bubble for things that need action (e.g. an inbox); default is a quiet gray count. */
  tone?: "alert" | "neutral";
}

/** URL-driven tabs (server-rendered). Build hrefs with search params, e.g. `?tab=done`. */
export function LinkTabs({ tabs, className }: { tabs: LinkTab[]; className?: string }) {
  return (
    <div className={cn("-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0", className)}>
      <nav className="inline-flex min-w-full gap-1 border-b border-ink-200 sm:min-w-0" aria-label="Tabs">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={t.active ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              t.active ? "border-brand-500 text-brand-700" : "border-transparent text-ink-500 hover:border-ink-300 hover:text-ink-800",
            )}
          >
            {t.label}
            {t.tone === "alert" ? (
              <CountBubble count={t.count ?? 0} />
            ) : (
              !!t.count && (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-ink-100 px-1.5 text-[11px] font-semibold leading-5 tabular-nums text-ink-600">
                  {t.count > 99 ? "99+" : t.count}
                </span>
              )
            )}
          </Link>
        ))}
      </nav>
    </div>
  );
}
