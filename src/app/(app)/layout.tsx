import { AppShell } from "@/components/app/app-shell";
import { requireActiveUser } from "@/server/auth/session";
import { getNavCounts } from "@/server/queries/nav";

// Every page here is per-user; never prerender.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const actor = await requireActiveUser();
  const counts = await getNavCounts(actor);
  return (
    <AppShell actor={actor} counts={counts}>
      {children}
    </AppShell>
  );
}
