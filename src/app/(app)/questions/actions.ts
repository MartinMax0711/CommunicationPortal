"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { formDataToObject, runAction } from "@/server/action";
import { getServiceContext } from "@/server/context";
import { askQuestion } from "@/server/services/questions";

export async function askQuestionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(
    async () => {
      const ctx = await getServiceContext();
      const { id } = await askQuestion(ctx, formDataToObject(formData));
      revalidatePath("/", "layout");
      redirect(`/questions/${id}`);
    },
    { formData },
  );
}
