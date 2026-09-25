import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Inline text link with a tap area of at least 40px. */
export const authLinkClasses =
  "inline-flex min-h-10 items-center font-medium text-brand-700 underline-offset-2 hover:text-brand-800 hover:underline";

type Tone = "brand" | "amber" | "red" | "gray";

const toneClasses: Record<Tone, string> = {
  brand: "bg-brand-50 text-brand-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-red-50 text-red-600",
  gray: "bg-ink-100 text-ink-500",
};

/** Title block at the top of the auth card. */
export function AuthHeader({
  title,
  description,
  icon: Icon,
  tone = "brand",
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
}) {
  return (
    <div className="mb-6 text-center">
      {Icon && (
        <div className={cn("mx-auto mb-3 flex size-12 items-center justify-center rounded-full", toneClasses[tone])}>
          <Icon className="size-6" aria-hidden />
        </div>
      )}
      <h1 className="font-display text-2xl font-semibold uppercase tracking-wide text-ink-900">{title}</h1>
      {description && <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{description}</p>}
    </div>
  );
}

/** "New to the team? Create an account" style line under a form. */
export function AuthSwitch({ prompt, href, children }: { prompt: ReactNode; href: string; children: ReactNode }) {
  return (
    <p className="mt-6 border-t border-ink-100 pt-4 text-center text-sm text-ink-600">
      {prompt}{" "}
      <Link href={href} className={authLinkClasses}>
        {children}
      </Link>
    </p>
  );
}
