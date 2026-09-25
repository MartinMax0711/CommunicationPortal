"use client";

import { useActionState } from "react";
import type { ResourceType } from "@/generated/prisma/enums";
import { Card, CardBody } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { CheckboxField, Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { type ActionState, initialActionState } from "@/lib/action-state";
import { LIMITS, RESOURCE_TYPE_LABELS, RESOURCE_TYPES } from "@/lib/constants";

export interface ResourceFormValues {
  id?: string;
  title: string;
  url: string;
  description: string;
  type: ResourceType;
  group: string;
  pinned: boolean;
  linksText: string;
}

/** Add / edit a resource. Values survive validation errors (fields remount on each result). */
export function ResourceForm({
  action,
  initial,
  groups,
  submitLabel,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initial: ResourceFormValues;
  groups: string[];
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  const v = state?.values;
  const errors = state?.fieldErrors ?? {};
  const value = (key: keyof ResourceFormValues, fallback: string) => v?.[key] ?? fallback;

  return (
    <form action={formAction} className="space-y-6">
      <FormMessage state={state} />
      {initial.id && <input type="hidden" name="resourceId" value={initial.id} />}
      <Card>
        <CardBody key={state?.nonce ?? 0} className="space-y-5">
          <Field label="Title" htmlFor="title" error={errors.title}>
            <Input id="title" name="title" invalid={!!errors.title} aria-describedby={errors.title ? "title-error" : undefined} required maxLength={LIMITS.resourceTitleMax} defaultValue={value("title", initial.title)} placeholder="e.g. Huskyteers Team Docs" />
          </Field>
          <Field label="Link" htmlFor="url" error={errors.url} hint="The full address, starting with https://">
            <Input id="url" name="url" invalid={!!errors.url} aria-describedby={errors.url ? "url-error" : undefined} type="url" inputMode="url" required maxLength={LIMITS.resourceUrlMax} defaultValue={value("url", initial.url)} placeholder="https://" />
          </Field>
          <Field label="Description" htmlFor="description" error={errors.description} optional>
            <Textarea id="description" name="description" invalid={!!errors.description} aria-describedby={errors.description ? "description-error" : undefined} rows={2} maxLength={LIMITS.resourceDescriptionMax} defaultValue={value("description", initial.description)} placeholder="What it's for, who uses it." />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Type" htmlFor="type" error={errors.type}>
              <Select id="type" name="type" invalid={!!errors.type} aria-describedby={errors.type ? "type-error" : undefined} defaultValue={value("type", initial.type)}>
                {RESOURCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {RESOURCE_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Section" htmlFor="group" error={errors.group} optional hint="Resources are grouped under this heading.">
              <Input id="group" name="group" invalid={!!errors.group} aria-describedby={errors.group ? "group-error" : undefined} list="resource-groups" maxLength={LIMITS.resourceGroupMax} defaultValue={value("group", initial.group)} placeholder="e.g. Team Docs" />
            </Field>
            <datalist id="resource-groups">
              {groups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>
          <Field
            label="Quick links"
            htmlFor="links"
            error={errors.links}
            optional
            hint="Shown as buttons on the card. One per line: Label | https://…"
          >
            <Textarea
              id="links"
              name="links"
              invalid={!!errors.links} aria-describedby={errors.links ? "links-error" : undefined}
              rows={5}
              className="font-mono text-xs sm:text-sm"
              defaultValue={v?.links ?? initial.linksText}
              placeholder={"Meeting Agenda | https://…\nImportant Dates | https://…"}
            />
          </Field>
          <CheckboxField
            name="pinned"
            label="Pin to the top"
            description="Pinned resources are shown first."
            defaultChecked={v ? v.pinned === "on" : initial.pinned}
          />
        </CardBody>
      </Card>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <ButtonLink href="/resources" variant="secondary">
          Cancel
        </ButtonLink>
        <SubmitButton pendingText="Saving…">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
