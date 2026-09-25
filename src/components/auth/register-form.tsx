"use client";

import { BriefcaseBusiness, CodeXml, type LucideIcon, Wrench } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { registerAction } from "@/app/(auth)/actions";
import type { Role, Subteam } from "@/generated/prisma/enums";
import { initialActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import { LIMITS, ROLE_LABELS, SUBTEAM_LABELS, subteamForRole } from "@/lib/constants";
import { Field, FieldError, Input, Select } from "../ui/field";
import { FormMessage } from "../ui/form-message";
import { SubmitButton } from "../ui/submit-button";
import { PasswordInput } from "./password-input";
import { useFocusFirstError } from "./use-focus-first-error";

const POSITIONS: Role[] = ["MEMBER", "SOFTWARE_LEADER", "BUILD_LEADER", "BUSINESS_LEADER", "CAPTAIN", "MENTOR", "TEACHER"];

const SUBTEAM_OPTIONS: { value: Subteam; icon: LucideIcon }[] = [
  { value: "SOFTWARE", icon: CodeXml },
  { value: "BUILD", icon: Wrench },
  { value: "BUSINESS", icon: BriefcaseBusiness },
];

function isRole(value: string): value is Role {
  return (POSITIONS as string[]).includes(value);
}

export function RegisterForm({ next, requiresJoinCode }: { next: string | null; requiresJoinCode: boolean }) {
  const [state, formAction] = useActionState(registerAction, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstError(state, formRef);
  const errors = state?.fieldErrors ?? {};

  // Choices the server doesn't echo back (selects/radios ignore defaultValue updates, and codes are never echoed).
  const [role, setRole] = useState("");
  const [subteam, setSubteam] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const implied = isRole(role) ? subteamForRole(role) : undefined;

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <FormMessage state={state} />
      {next && <input type="hidden" name="next" value={next} />}

      {/* Remounted after each submit so React's automatic form reset restores what was typed. */}
      <div key={state?.nonce ?? 0} className="space-y-4">
        {requiresJoinCode && (
          <Field label="Team code" htmlFor="joinCode" error={errors.joinCode} hint="Ask a leader for the current team code.">
            <Input
              id="joinCode"
              name="joinCode"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              maxLength={100}
              defaultValue={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              invalid={!!errors.joinCode}
              aria-describedby={errors.joinCode ? "joinCode-error" : undefined}
            />
          </Field>
        )}

        <Field label="Your name" htmlFor="name" error={errors.name} hint="First and last name, so your leaders know who you are.">
          <Input
            id="name"
            name="name"
            autoComplete="name"
            required
            maxLength={LIMITS.nameMax}
            defaultValue={state?.values?.name}
            invalid={!!errors.name}
            aria-describedby={errors.name ? "name-error" : undefined}
          />
        </Field>

        <Field label="Email" htmlFor="email" error={errors.email} hint="We'll send task and question updates here.">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            maxLength={LIMITS.emailMax}
            defaultValue={state?.values?.email}
            invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
        </Field>

        <div className="space-y-2">
          <Field label="Your position" htmlFor="role" error={errors.role}>
            <Select
              id="role"
              name="role"
              required
              defaultValue={role}
              onChange={(e) => setRole(e.target.value)}
              invalid={!!errors.role}
              aria-describedby={errors.role ? "role-error role-note" : "role-note"}
            >
              <option value="" disabled>
                Choose your position…
              </option>
              {POSITIONS.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          </Field>
          <p id="role-note" className="text-xs leading-relaxed text-ink-500">
            Leader, captain, mentor and teacher accounts are confirmed by the team admin before you can use the portal.
          </p>
        </div>

        {role === "MEMBER" && (
          <fieldset aria-describedby={errors.subteam ? "subteam-error" : undefined}>
            <legend className="text-sm font-medium text-ink-800">Your subteam</legend>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {SUBTEAM_OPTIONS.map(({ value, icon: Icon }) => (
                <label
                  key={value}
                  className={cn(
                    "flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border bg-white px-2 py-3 text-sm font-medium text-ink-700 shadow-sm transition-colors hover:border-brand-300",
                    "has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-800 has-[:checked]:ring-1 has-[:checked]:ring-brand-500",
                    "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500/40",
                    errors.subteam ? "border-red-400" : "border-ink-200",
                  )}
                >
                  <input
                    type="radio"
                    name="subteam"
                    value={value}
                    defaultChecked={subteam === value}
                    onChange={() => setSubteam(value)}
                    data-invalid={errors.subteam ? "true" : undefined}
                    className="sr-only"
                  />
                  <Icon className="size-5" aria-hidden />
                  {SUBTEAM_LABELS[value]}
                </label>
              ))}
            </div>
            <FieldError id="subteam-error">{errors.subteam}</FieldError>
          </fieldset>
        )}

        {implied !== undefined && (
          <p className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-2.5 text-sm text-ink-700">
            Subteam: <span className="font-medium text-ink-900">{implied ? SUBTEAM_LABELS[implied] : "Whole team"}</span>
            {implied === null && <span className="text-ink-500"> · you&apos;ll see every subteam</span>}
          </p>
        )}

        <Field label="Password" htmlFor="password" error={errors.password} hint={`At least ${LIMITS.passwordMin} characters.`}>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={LIMITS.passwordMin}
            maxLength={LIMITS.passwordMax}
            invalid={!!errors.password}
            aria-describedby={errors.password ? "password-error" : undefined}
          />
        </Field>

        <Field label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword}>
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            required
            maxLength={LIMITS.passwordMax}
            invalid={!!errors.confirmPassword}
            aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
          />
        </Field>
      </div>

      <SubmitButton size="lg" className="w-full" pendingText="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}
