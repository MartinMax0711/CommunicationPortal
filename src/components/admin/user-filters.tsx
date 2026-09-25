import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { ROLES, ROLE_LABELS, STATUS_LABELS, SUBTEAMS, SUBTEAM_LABELS } from "@/lib/constants";
import { AccountStatus } from "@/generated/prisma/enums";
import type { UserFilters as Filters } from "@/server/queries/admin";

const STATUSES = Object.values(AccountStatus);

/** Plain GET form so filters live in the URL (shareable, back-button friendly, no JS needed). */
export function UserFilters({ filters }: { filters: Filters }) {
  return (
    <form method="get" action="/admin/users" role="search" className="flex flex-col gap-2 xl:flex-row">
      <div className="relative xl:flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
        <Input
          type="search"
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Search name or email"
          aria-label="Search name or email"
          maxLength={100}
          className="pl-9"
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:flex">
        <Select name="status" defaultValue={filters.status ?? ""} aria-label="Status" className="xl:w-40">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Select name="role" defaultValue={filters.role ?? ""} aria-label="Position" className="xl:w-40">
          <option value="">All positions</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
        <Select name="subteam" defaultValue={filters.subteam ?? ""} aria-label="Subteam" className="xl:w-44">
          <option value="">All subteams</option>
          {SUBTEAMS.map((s) => (
            <option key={s} value={s}>
              {SUBTEAM_LABELS[s]}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </div>
    </form>
  );
}
