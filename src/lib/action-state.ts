// Shape returned by every form Server Action (consumed with useActionState). Client-safe.
export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  /**
   * On failure: the submitted text values (passwords excluded), so the form can re-render them.
   * React resets uncontrolled forms after an action — use `defaultValue={state?.values?.title ?? initial}`.
   */
  values?: Record<string, string>;
  /** Bumps on every submission so clients can react (e.g. reset a form or close a panel). */
  nonce?: number;
} | null;

export const initialActionState: ActionState = null;
