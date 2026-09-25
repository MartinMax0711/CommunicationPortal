import { cn } from "@/lib/cn";
import { RichText } from "../ui/rich-text";

/** A labelled, quoted bit of user text (submission note, reviewer feedback). */
export function NoteBlock({
  label,
  text,
  tone = "neutral",
  className,
}: {
  label: string;
  text: string;
  tone?: "neutral" | "feedback";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        tone === "feedback" ? "border-amber-200 bg-amber-50/70" : "border-ink-100 bg-ink-50",
        className,
      )}
    >
      <p className={cn("mb-0.5 text-xs font-semibold", tone === "feedback" ? "text-amber-800" : "text-ink-500")}>{label}</p>
      <RichText text={text} className="text-ink-800" />
    </div>
  );
}
