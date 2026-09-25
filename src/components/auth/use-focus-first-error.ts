"use client";

import { type RefObject, useEffect } from "react";
import type { ActionState } from "@/lib/action-state";

/**
 * After a failed submit, move focus to the first invalid field so people see what to fix.
 * Controls mark themselves with aria-invalid (or data-invalid where ARIA doesn't allow it, e.g. radios).
 */
export function useFocusFirstError(state: ActionState, formRef: RefObject<HTMLFormElement | null>) {
  useEffect(() => {
    if (!state || state.ok || !state.fieldErrors || Object.keys(state.fieldErrors).length === 0) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"]')?.focus();
  }, [state, formRef]);
}
