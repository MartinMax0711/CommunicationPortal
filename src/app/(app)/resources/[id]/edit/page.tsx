import { Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ResourceForm } from "@/components/resources/resource-form";
import { BackLink } from "@/components/tasks/back-link";
import { ActionForm } from "@/components/tasks/action-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireActiveUser } from "@/server/auth/session";
import { canManageResources } from "@/server/permissions";
import { getResourceForEdit, listResourceGroups } from "@/server/queries/resources";
import { deleteResourceAction, updateResourceAction } from "../../actions";

export const metadata: Metadata = { title: "Edit resource" };

export default async function EditResourcePage({ params }: PageProps<"/resources/[id]/edit">) {
  const actor = await requireActiveUser();
  if (!canManageResources(actor)) redirect("/resources");
  const { id } = await params;
  const [resource, groups] = await Promise.all([getResourceForEdit(actor, id), listResourceGroups()]);
  if (!resource) notFound();

  return (
    <>
      <BackLink href="/resources">Resources</BackLink>
      <PageHeader
        title="Edit resource"
        description={resource.title}
        actions={
          <ActionForm
            action={deleteResourceAction}
            fields={{ resourceId: resource.id }}
            variant="secondary"
            confirm={`Remove “${resource.title}” from Resources?`}
            pendingText="Removing…"
            aria-label={`Remove ${resource.title}`}
          >
            <Trash2 className="size-4" aria-hidden />
            Remove
          </ActionForm>
        }
      />
      <ResourceForm
        action={updateResourceAction}
        groups={groups}
        submitLabel="Save changes"
        initial={{
          id: resource.id,
          title: resource.title,
          url: resource.url,
          description: resource.description,
          type: resource.type,
          group: resource.group,
          pinned: resource.pinned,
          linksText: resource.linksText,
        }}
      />
    </>
  );
}
