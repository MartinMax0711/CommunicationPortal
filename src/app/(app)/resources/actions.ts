"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { formDataToObject, runAction } from "@/server/action";
import { getServiceContext } from "@/server/context";
import { createResource, deleteResource, updateResource } from "@/server/services/resources";

export async function createResourceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(
    async () => {
      const ctx = await getServiceContext();
      await createResource(ctx, formDataToObject(formData));
      revalidatePath("/resources");
      redirect("/resources");
    },
    { formData },
  );
}

export async function updateResourceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(
    async () => {
      const ctx = await getServiceContext();
      await updateResource(ctx, formDataToObject(formData));
      revalidatePath("/resources");
      redirect("/resources");
    },
    { formData },
  );
}

export async function deleteResourceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(
    async () => {
      const ctx = await getServiceContext();
      await deleteResource(ctx, formDataToObject(formData));
      revalidatePath("/resources");
      redirect("/resources");
    },
    { formData },
  );
}
