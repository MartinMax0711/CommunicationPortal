import type { ActionState } from "@/lib/action-state";
import { Alert } from "./alert";

/** Shows the message from a Server Action's ActionState (success or error). */
export function FormMessage({ state, className }: { state: ActionState; className?: string }) {
  if (!state?.message) return null;
  return (
    <Alert tone={state.ok ? "success" : "error"} className={className}>
      {state.message}
    </Alert>
  );
}
