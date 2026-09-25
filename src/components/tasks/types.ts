import type { ActionState } from "@/lib/action-state";

/** A Server Action usable with useActionState. */
export type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;
