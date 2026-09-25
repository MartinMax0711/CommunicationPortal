"use client";

import { Loader2 } from "lucide-react";
import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "./button";

/**
 * Submit button that disables itself and shows a spinner while its <form> is submitting.
 * Pass `confirm` to ask before submitting (e.g. destructive actions).
 */
export function SubmitButton({
  children,
  pendingText,
  confirm: confirmText,
  disabled,
  onClick,
  ...props
}: ComponentProps<typeof Button> & { pendingText?: string; confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      onClick={(e) => {
        if (confirmText && !window.confirm(confirmText)) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      {...props}
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}
