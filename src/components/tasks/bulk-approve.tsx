"use client";

import { CheckCheck } from "lucide-react";
import { createContext, type ReactNode, useActionState, useContext, useState } from "react";
import { type ActionState, initialActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import { Button } from "../ui/button";
import { FormMessage } from "../ui/form-message";
import { SubmitButton } from "../ui/submit-button";
import type { FormAction } from "./types";

interface BulkContextValue {
  /** Selected ids that are still in the queue. */
  selected: string[];
  isSelected(id: string): boolean;
  set(ids: string[], on: boolean): void;
  clear(): void;
  allIds: string[];
  state: ActionState;
  formAction: (formData: FormData) => void;
}

const BulkContext = createContext<BulkContextValue | null>(null);

function useBulk(): BulkContextValue {
  const ctx = useContext(BulkContext);
  if (!ctx) throw new Error("Bulk approve components must be inside <BulkApproveProvider>.");
  return ctx;
}

/**
 * Holds the review-queue selection. Children render `<BulkCheckbox>`s; a sticky
 * "Approve selected (N)" bar appears at the bottom once something is selected.
 */
export function BulkApproveProvider({ ids, action, children }: { ids: string[]; action: FormAction; children: ReactNode }) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [state, formAction] = useActionState(action, initialActionState);

  // Clear the selection once a bulk approve succeeds (adjusting state during render, no effect needed).
  const [seenNonce, setSeenNonce] = useState(state?.nonce);
  if (state?.nonce !== seenNonce) {
    setSeenNonce(state?.nonce);
    if (state?.ok) setPicked(new Set());
  }

  // Items approved elsewhere drop out of `ids` after a refresh; ignore them.
  const selected = ids.filter((id) => picked.has(id));
  const value: BulkContextValue = {
    selected,
    isSelected: (id) => picked.has(id),
    set: (list, on) =>
      setPicked((prev) => {
        const next = new Set(prev);
        for (const id of list) {
          if (on) next.add(id);
          else next.delete(id);
        }
        return next;
      }),
    clear: () => setPicked(new Set()),
    allIds: ids,
    state,
    formAction,
  };

  return (
    <BulkContext.Provider value={value}>
      <div>
        {children}
        <BulkApproveBar />
      </div>
    </BulkContext.Provider>
  );
}

/** Checkbox with a 40px tap area that adds/removes one submission from the selection. */
export function BulkCheckbox({ id, label }: { id: string; label: string }) {
  const { isSelected, set } = useBulk();
  return (
    <label className="-m-2 flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-ink-100">
      <input
        type="checkbox"
        checked={isSelected(id)}
        onChange={(e) => set([id], e.target.checked)}
        aria-label={`Select ${label} for bulk approve`}
        className="size-5 rounded border-ink-300"
      />
    </label>
  );
}

/**
 * "Select all" / "Clear" for a group of ids (e.g. every submission on one task).
 * `label` names the group (the task title) so screen readers can tell the buttons apart.
 */
export function BulkSelectGroup({ ids, label, className }: { ids: string[]; label: string; className?: string }) {
  const { isSelected, set } = useBulk();
  const all = ids.length > 0 && ids.every(isSelected);
  return (
    <Button
      variant="ghost"
      className={cn("px-3 text-brand-700", className)}
      onClick={() => set(ids, !all)}
      aria-label={all ? `Clear selected submissions for ${label}` : `Select all submissions for ${label}`}
    >
      {all ? "Clear" : "Select all"}
    </Button>
  );
}

/** Top-of-queue controls: select everything, and the result of the last bulk approve. */
export function BulkToolbar({ className }: { className?: string }) {
  const { allIds, selected, set, clear, state } = useBulk();
  const all = allIds.length > 0 && selected.length === allIds.length;
  return (
    <div className={cn("space-y-3", className)}>
      <FormMessage state={state} />
      {allIds.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-ink-500">Tick submissions to approve several at once.</p>
          <Button variant="secondary" onClick={() => (all ? clear() : set(allIds, true))}>
            <CheckCheck className="size-4" aria-hidden />
            {all ? "Clear selection" : `Select all (${allIds.length})`}
          </Button>
        </div>
      )}
    </div>
  );
}

function BulkApproveBar() {
  const { selected, clear, formAction } = useBulk();
  if (selected.length === 0) return null;
  return (
    <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 mt-4 lg:bottom-6">
      <form
        action={formAction}
        className="flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-white/95 p-2 pl-4 shadow-lg backdrop-blur"
      >
        {selected.map((id) => (
          <input key={id} type="hidden" name="assignmentIds" value={id} />
        ))}
        <div className="flex min-w-0 items-center gap-1">
          <span className="text-sm font-medium tabular-nums text-ink-800">{selected.length} selected</span>
          <Button variant="ghost" className="px-2.5" onClick={clear}>
            Clear
          </Button>
        </div>
        <SubmitButton variant="success" pendingText="Approving…">
          <CheckCheck className="size-4" aria-hidden />
          <span>
            Approve<span className="hidden min-[400px]:inline"> selected</span> ({selected.length})
          </span>
        </SubmitButton>
      </form>
    </div>
  );
}
