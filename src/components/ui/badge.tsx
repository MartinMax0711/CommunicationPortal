import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "gray" | "green" | "yellow" | "red" | "blue" | "purple" | "brand";

const tones: Record<BadgeTone, string> = {
  gray: "bg-ink-100 text-ink-700 ring-ink-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  yellow: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  purple: "bg-violet-50 text-violet-700 ring-violet-200",
  brand: "bg-brand-50 text-brand-700 ring-brand-200",
};

export function Badge({ tone = "gray", className, ...props }: ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

/** Small count bubble for navigation. Renders nothing for 0. */
export function CountBubble({ count, className }: { count: number; className?: string }) {
  if (!count) return null;
  return (
    <span
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold leading-5 text-white",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
