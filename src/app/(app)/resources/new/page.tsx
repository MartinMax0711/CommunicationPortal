import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BackLink } from "@/components/tasks/back-link";
import { ResourceForm } from "@/components/resources/resource-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireActiveUser } from "@/server/auth/session";
import { canManageResources } from "@/server/permissions";
import { listResourceGroups } from "@/server/queries/resources";
import { createResourceAction } from "../actions";

export const metadata: Metadata = { title: "Add resource" };

export default async function NewResourcePage() {
  const actor = await requireActiveUser();
  if (!canManageResources(actor)) redirect("/resources");
  const groups = await listResourceGroups();
  return (
    <>
      <BackLink href="/resources">Resources</BackLink>
      <PageHeader title="Add resource" description="Everyone on the team will see it on the Resources page." />
      <ResourceForm
        action={createResourceAction}
        groups={groups}
        submitLabel="Add resource"
        initial={{ title: "", url: "", description: "", type: "DOCUMENT", group: "", pinned: false, linksText: "" }}
      />
    </>
  );
}
