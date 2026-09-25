import { Fragment } from "react";
import { cn } from "@/lib/cn";

const URL_RE = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])/g;

/** User-written text: keeps line breaks and turns http(s) URLs into safe links. Never renders HTML. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(URL_RE);
  return (
    <div className={cn("whitespace-pre-wrap break-words leading-relaxed", className)}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer nofollow" className="text-brand-700 underline underline-offset-2 hover:text-brand-800">
            {part}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </div>
  );
}
