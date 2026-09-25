import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "./button";

/** Prev/next links. `hrefFor(page)` builds the URL for a page number (1-based). */
export function Pagination({
  page,
  pageCount,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-between gap-3" aria-label="Pagination">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={buttonClasses("secondary", "sm")}>
          <ChevronLeft className="size-4" aria-hidden /> Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm text-ink-500">
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} className={buttonClasses("secondary", "sm")}>
          Next <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

/** Parse a `?page=` value safely. */
export function parsePage(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 0 ? Math.min(n, 10_000) : 1;
}
