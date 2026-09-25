import { describeRole } from "@/components/app/user-chip";
import { Avatar } from "@/components/ui/avatar";
import type { Role, Subteam } from "@/generated/prisma/enums";
import { cn } from "@/lib/cn";

/**
 * Avatar + full name + "Build member" line. Like UserChip, but long names wrap instead of being
 * cut off, so leaders can always tell who a progress row is about.
 */
export function PersonLabel({
  name,
  role,
  subteam,
  className,
  nameClassName,
}: {
  name: string;
  role: Role;
  subteam: Subteam | null;
  className?: string;
  nameClassName?: string;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <Avatar name={name} />
      <span className="min-w-0 leading-tight">
        <span className={cn("block break-words text-sm font-medium text-ink-900", nameClassName)}>{name}</span>
        <span className="mt-0.5 block break-words text-xs text-ink-500">{describeRole(role, subteam)}</span>
      </span>
    </span>
  );
}
