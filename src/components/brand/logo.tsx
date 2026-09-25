import { TEAM_NAME, TEAM_NUMBER } from "@/lib/constants";

/** The husky mark. The artwork lives in /public/brand/husky-mark.svg — swap that file to update it everywhere. */
export function HuskyMark({ className = "size-10" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/husky-mark.svg" alt="" aria-hidden className={className} />;
}

/** Mark + "THE HUSKYTEERS / 19516" wordmark, as on the team banner. */
export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const mark = { sm: "size-8", md: "size-10", lg: "size-16" }[size];
  const name = { sm: "text-base", md: "text-lg", lg: "text-3xl" }[size];
  const number = { sm: "text-sm", md: "text-base", lg: "text-2xl" }[size];
  return (
    <span className="inline-flex items-center gap-2.5">
      <HuskyMark className={mark} />
      <span className="flex flex-col leading-none">
        <span className={`font-display font-bold uppercase tracking-wide text-brand-500 ${name}`}>{TEAM_NAME}</span>
        <span className={`font-display font-bold text-ink-500 ${number}`}>{TEAM_NUMBER}</span>
      </span>
    </span>
  );
}
