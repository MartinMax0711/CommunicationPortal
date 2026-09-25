import type { Metadata } from "next";
import { PendingList } from "@/components/admin/pending-list";
import type { SeatInfo } from "@/components/admin/position-fields";
import { RecentDecisions } from "@/components/admin/recent-decisions";
import { SeatUsageCard } from "@/components/admin/seat-usage-card";
import { PageHeader } from "@/components/ui/page-header";
import type { Role } from "@/generated/prisma/enums";
import { formatDateTime, timeAgo } from "@/lib/dates";
import { requireAdminUser } from "@/server/auth/session";
import { env } from "@/server/env";
import { getPendingUsers, getRecentDecisions, getSeatUsage } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Approvals" };

export default async function ApprovalsPage() {
  const actor = await requireAdminUser();
  const [pending, seats, decisions] = await Promise.all([
    getPendingUsers(actor),
    getSeatUsage(actor),
    getRecentDecisions(actor, 10),
  ]);
  const now = new Date();
  const seatMap: Partial<Record<Role, SeatInfo>> = Object.fromEntries(
    seats.map((s) => [s.role, { filled: s.filled, limit: s.limit }]),
  );

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Approvals"
        description={
          pending.total === 0
            ? "Leaders, captains, mentors, and teachers need your OK before they can use the portal."
            : `${pending.total} ${pending.total === 1 ? "person is" : "people are"} waiting for your OK.`
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-label="Waiting for approval" className="min-w-0">
          <PendingList
            total={pending.total}
            seats={seatMap}
            users={pending.users.map((u) => ({
              id: u.id,
              name: u.name,
              email: u.email,
              role: u.role,
              subteam: u.subteam,
              registeredAgo: timeAgo(u.createdAt, now, env.teamTimezone),
              registeredAt: formatDateTime(u.createdAt, env.teamTimezone),
            }))}
          />
        </section>
        <aside className="min-w-0 space-y-6">
          <SeatUsageCard seats={seats} />
          <RecentDecisions decisions={decisions} now={now} timeZone={env.teamTimezone} />
        </aside>
      </div>
    </>
  );
}
