import { BookMarked, Plus } from "lucide-react";
import type { Metadata } from "next";
import { ResourceCard } from "@/components/resources/resource-card";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireActiveUser } from "@/server/auth/session";
import { listResources } from "@/server/queries/resources";

export const metadata: Metadata = { title: "Resources" };

export default async function ResourcesPage() {
  const actor = await requireActiveUser();
  const { groups, canManage, total } = await listResources(actor);
  const addButton = canManage ? (
    <ButtonLink href="/resources/new">
      <Plus className="size-4" aria-hidden />
      Add resource
    </ButtonLink>
  ) : null;

  return (
    <>
      <PageHeader title="Resources" description="Team docs, tools, and links in one place." actions={addButton} />
      {total === 0 ? (
        <Card>
          <EmptyState
            icon={BookMarked}
            title="No resources yet"
            description={canManage ? "Add the team docs, CAD, inventory tracker, game manual…" : "Your leaders haven't added any links yet."}
            action={addButton}
          />
        </Card>
      ) : (
        <div className="space-y-8">
          {groups.map((g, i) => (
            <section key={g.name} aria-labelledby={`resource-group-${i}`}>
              <h2 id={`resource-group-${i}`} className="mb-3 font-display text-lg font-semibold uppercase tracking-wide text-ink-800">
                {g.name}
              </h2>
              <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {g.items.map((item) => (
                  <ResourceCard key={item.id} item={item} canManage={canManage} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
