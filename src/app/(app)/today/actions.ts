"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { formDataToObject, runAction } from "@/server/action";
import { getServiceContext } from "@/server/context";
import { submitAssignment, updateSubmissionNote, withdrawAssignment } from "@/server/services/checklist";

// Checklist actions shared by /today and /my-tasks. The assignment id is bound on the client
// (`submitAction(id)` or `updateNoteAction.bind(null, id)`); services re-check ownership in the DB.

/** Check an item off (sends it to a leader for review). Optional `note` field. */
export async function submitAction(assignmentId: string, _prev?: ActionState, formData?: FormData): Promise<ActionState> {
  return runAction(
    async () => {
      const ctx = await getServiceContext();
      const note = formData ? formDataToObject(formData).note : undefined;
      await submitAssignment(ctx, { assignmentId, note });
      revalidatePath("/", "layout");
    },
    { success: "Checked off. A leader will review it.", formData },
  );
}

/** Uncheck an item that is still waiting for review. */
export async function withdrawAction(assignmentId: string): Promise<ActionState> {
  return runAction(
    async () => {
      const ctx = await getServiceContext();
      await withdrawAssignment(ctx, { assignmentId });
      revalidatePath("/", "layout");
    },
    { success: "Unchecked." },
  );
}

/** Save (or clear) the note sent with a submission. Use with useActionState + bind. */
export async function updateNoteAction(assignmentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(
    async () => {
      const ctx = await getServiceContext();
      const { note } = formDataToObject(formData);
      await updateSubmissionNote(ctx, { assignmentId, note: note ?? "" });
      revalidatePath("/", "layout");
    },
    { success: "Note saved.", formData },
  );
}
