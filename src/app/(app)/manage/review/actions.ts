"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { formDataToObject, runAction } from "@/server/action";
import { getServiceContext } from "@/server/context";
import { approveMany, reviewAssignment } from "@/server/services/tasks";

/** Approve or send back one submission (fields: assignmentId, decision, note). */
export async function reviewAssignmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(
    async () => {
      const ctx = await getServiceContext();
      const input = formDataToObject(formData);
      await reviewAssignment(ctx, input);
      revalidatePath("/", "layout");
      return input.decision === "reject" ? "Sent back with your note." : "Approved.";
    },
    { formData },
  );
}

/** Approve every selected submission the reviewer is allowed to approve (fields: assignmentIds[]). */
export async function approveManyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await getServiceContext();
    const { approved, skipped } = await approveMany(ctx, formDataToObject(formData));
    revalidatePath("/", "layout");
    const done = approved === 1 ? "Approved 1 submission." : `Approved ${approved} submissions.`;
    return skipped > 0 ? `${done} ${skipped} skipped — already reviewed, withdrawn, or not yours to review.` : done;
  });
}
