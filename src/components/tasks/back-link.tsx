import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** Small "← Back" link shown above a page header. */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="-ml-2 mb-2 inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-ink-500 hover:bg-ink-100 hover:text-ink-800"
    >
      <ArrowLeft className="size-4" aria-hidden />
      {children}
    </Link>
  );
}
