"use client";

import { Send } from "lucide-react";
import { useActionState } from "react";
import { FieldError, Label, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { type ActionState, initialActionState } from "@/lib/action-state";
import { LIMITS } from "@/lib/constants";

/** Reply box at the bottom of a thread. Clears itself after a successful send. */
export function ReplyForm({
  action,
  hint,
  placeholder = "Write a reply…",
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  hint?: string;
  placeholder?: string;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  const error = state?.fieldErrors?.body;
  // A new key after each successful send remounts the form, so the textarea starts empty.
  const formKey = state?.ok ? `sent-${state.nonce}` : "draft";

  return (
    <form key={formKey} action={formAction} className="space-y-3">
      {state && !state.ok && !error && <FormMessage state={state} />}
      <Label htmlFor="reply-body">Your reply</Label>
      {hint && (
        <p id="reply-body-hint" className="-mt-1.5 text-xs text-ink-500">
          {hint}
        </p>
      )}
      <Textarea
        id="reply-body"
        name="body"
        rows={4}
        required
        maxLength={LIMITS.replyBodyMax}
        placeholder={placeholder}
        defaultValue={state?.ok ? "" : (state?.values?.body ?? "")}
        invalid={!!error}
        aria-describedby={[hint && "reply-body-hint", error && "reply-body-error"].filter(Boolean).join(" ") || undefined}
      />
      <FieldError id="reply-body-error">{error}</FieldError>
      <div className="flex justify-end">
        <SubmitButton pendingText="Sending…" className="w-full sm:w-auto">
          <Send className="size-4" aria-hidden />
          Send
        </SubmitButton>
      </div>
    </form>
  );
}
