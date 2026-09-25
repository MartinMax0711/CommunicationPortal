"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { formDataToObject, runAction } from "@/server/action";
import { getServiceContext } from "@/server/context";
import { deleteQuestion, replyToQuestion, setQuestionStatus } from "@/server/services/questions";

// The question id is a bound argument; the services re-load the question and re-check permissions.

export async function replyToQuestionAction(
  questionId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(
    async () => {
      const ctx = await getServiceContext();
      await replyToQuestion(ctx, { ...formDataToObject(formData), questionId });
      revalidatePath("/", "layout");
    },
    { formData },
  );
}

export async function setQuestionStatusAction(questionId: string, status: "RESOLVED" | "OPEN"): Promise<ActionState> {
  return runAction(
    async () => {
      const ctx = await getServiceContext();
      await setQuestionStatus(ctx, { questionId, status });
      revalidatePath("/", "layout");
    },
    { success: status === "RESOLVED" ? "Marked as resolved." : "Question reopened." },
  );
}

export async function deleteQuestionAction(questionId: string): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await getServiceContext();
    await deleteQuestion(ctx, { questionId });
    revalidatePath("/", "layout");
    redirect("/questions");
  });
}
