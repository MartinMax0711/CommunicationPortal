"use client";

import { useActionState } from "react";
import { updateUserAction } from "@/app/(app)/admin/actions";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CheckboxField, Field, FieldError, Input, Select } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { AccountStatus, type Role, type Subteam } from "@/generated/prisma/enums";
import { initialActionState } from "@/lib/action-state";
import { LIMITS, STATUS_LABELS } from "@/lib/constants";
import { PositionFields, type SeatInfo } from "./position-fields";

const STATUSES = Object.values(AccountStatus);

export interface EditableUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  subteam: Subteam | null;
  status: AccountStatus;
  isAdmin: boolean;
}

export function UserEditForm({
  user,
  isSelf,
  inAdminEmails = false,
  seats,
}: {
  user: EditableUser;
  isSelf: boolean;
  /** The email is listed in ADMIN_EMAILS (shows a short explanation next to the Admin checkbox). */
  inAdminEmails?: boolean;
  seats: Partial<Record<Role, SeatInfo>>;
}) {
  const [state, formAction] = useActionState(updateUserAction, initialActionState);
  // After a failed save, show what was submitted; after a successful one (no values), the saved values.
  const v = state?.values;
  const err = state?.fieldErrors;
  const isAdminDefault = v ? v.isAdmin === "on" : user.isAdmin;
  const statusDefault = (v?.status as AccountStatus | undefined) ?? user.status;

  return (
    <Card>
      <CardHeader title="Profile & access" />
      <CardBody>
        <form action={formAction} className="space-y-5" noValidate>
          <input type="hidden" name="userId" value={user.id} />
          {isSelf && <input type="hidden" name="status" value="ACTIVE" />}
          {isSelf && <input type="hidden" name="isAdmin" value="on" />}
          <FormMessage state={state} />

          {/*
            Remount every field after each save. React resets a form after its action runs but never
            re-applies a changed <select> defaultValue, so without this the Status select would snap back
            to its first value and the next save would silently undo the last one (or skip the seat check
            after "Approve anyway"). It must keep working for two saves in a row.
          */}
          <div key={state?.nonce ?? "initial"} className="space-y-5">
            <Field label="Name" htmlFor="edit-name" error={err?.name}>
              <Input
                id="edit-name"
                name="name"
                defaultValue={v?.name ?? user.name}
                maxLength={LIMITS.nameMax}
                autoComplete="off"
                required
                invalid={!!err?.name}
              />
            </Field>

            <Field
              label="Email"
              htmlFor="edit-email"
              error={err?.email}
              hint="Used to sign in and for notifications. Changing it cancels any reset link already sent."
            >
              <Input
                id="edit-email"
                name="email"
                type="email"
                defaultValue={v?.email ?? user.email}
                maxLength={LIMITS.emailMax}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                required
                invalid={!!err?.email}
              />
            </Field>

            <PositionFields
              idPrefix="edit"
              defaultRole={(v?.role as Role | undefined) ?? user.role}
              defaultSubteam={(v?.subteam as Subteam | undefined) ?? user.subteam}
              errors={err}
              seats={seats}
            />

            <Field
              label="Account status"
              htmlFor="edit-status"
              error={err?.status}
              hint={isSelf ? "Your own account always stays active." : "Disabled and rejected people are signed out right away."}
            >
              <Select
                id="edit-status"
                name={isSelf ? undefined : "status"}
                defaultValue={isSelf ? "ACTIVE" : statusDefault}
                disabled={isSelf}
                invalid={!!err?.status}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="space-y-4 rounded-lg border border-ink-200 bg-ink-50/60 p-3">
              <div>
                <CheckboxField
                  name={isSelf ? undefined : "isAdmin"}
                  label="Admin"
                  description={
                    isSelf
                      ? "You can't remove your own admin access — ask another admin."
                      : "Can approve sign-ups, edit people, and see the email log."
                  }
                  defaultChecked={isSelf || isAdminDefault}
                  disabled={isSelf}
                />
                <FieldError>{err?.isAdmin}</FieldError>
                {inAdminEmails && (
                  <p className="mt-1.5 pl-7 text-xs text-ink-500">
                    This email is in ADMIN_EMAILS. It only matters before the first admin exists.
                  </p>
                )}
              </div>
              <CheckboxField
                name="overrideSeatLimit"
                label="Approve anyway (over seat limit)"
                description="Only needed if this change puts more people in a leadership seat than planned."
                // Stays ticked after a failed save, so "tick Approve anyway and save again" works.
                defaultChecked={v?.overrideSeatLimit === "on"}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <SubmitButton className="w-full sm:w-auto" pendingText="Saving…">
              Save changes
            </SubmitButton>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
