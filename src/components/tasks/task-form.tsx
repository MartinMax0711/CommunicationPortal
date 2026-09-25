"use client";

import { LoaderCircle } from "lucide-react";
import { type FormEvent, startTransition, useActionState, useState } from "react";
import type { Priority, Subteam } from "@/generated/prisma/enums";
import { initialActionState } from "@/lib/action-state";
import { LIMITS, PRIORITY_LABELS, SUBTEAM_LABELS } from "@/lib/constants";
import type { DateOnly } from "@/lib/dates";
import type { AssigneeGroup, SubteamOption } from "@/server/queries/tasks";
import { Alert } from "../ui/alert";
import { Button, ButtonLink } from "../ui/button";
import { Card, CardBody } from "../ui/card";
import { Field, Input, Select, Textarea } from "../ui/field";
import { FormMessage } from "../ui/form-message";
import { AssigneePicker } from "./assignee-picker";
import type { FormAction } from "./types";

export interface TaskFormInitial {
  title: string;
  description: string;
  subteam: "" | Subteam;
  dueDate: DateOnly;
  priority: Priority;
  assigneeIds: string[];
}

const PRIORITIES: Priority[] = ["LOW", "NORMAL", "HIGH"];

/** Create / edit a task. Used by /manage/tasks/new and /manage/tasks/[id]/edit. */
export function TaskForm({
  action,
  mode,
  taskId,
  initial,
  subteamOptions,
  groups,
  minDate,
  maxDate,
  cancelHref,
}: {
  action: FormAction;
  mode: "create" | "edit";
  taskId?: string;
  initial: TaskFormInitial;
  subteamOptions: SubteamOption[];
  groups: AssigneeGroup[];
  minDate: DateOnly;
  maxDate: DateOnly;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const [subteam, setSubteam] = useState<"" | Subteam>(
    subteamOptions.some((o) => o.value === initial.subteam) ? initial.subteam : (subteamOptions[0]?.value ?? ""),
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initial.assigneeIds));
  const values = state?.values;
  const errors = state?.fieldErrors;
  const removedCount = mode === "edit" ? initial.assigneeIds.filter((id) => !selected.has(id)).length : 0;
  const movedAway = mode === "edit" && !subteamOptions.some((o) => o.value === initial.subteam);

  // Submit without React's automatic form reset so the picker's selection and every field
  // survive a validation error (success redirects away).
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => formAction(formData));
  }

  const onlySubteam = subteamOptions.length === 1 ? subteamOptions[0] : null;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {taskId && <input type="hidden" name="taskId" value={taskId} />}
      <Card>
        <CardBody className="space-y-5">
          <Field label="Title" htmlFor="title" error={errors?.title}>
            <Input
              id="title"
              name="title"
              required
              maxLength={LIMITS.taskTitleMax}
              defaultValue={values?.title ?? initial.title}
              placeholder="e.g. Finish the intake CAD"
              invalid={!!errors?.title}
              aria-describedby={errors?.title ? "title-error" : undefined}
            />
          </Field>

          <Field
            label="Details"
            htmlFor="description"
            optional
            hint="Steps, links, what “done” looks like. Links become clickable."
            error={errors?.description}
          >
            <Textarea
              id="description"
              name="description"
              rows={4}
              maxLength={LIMITS.taskDescriptionMax}
              defaultValue={values?.description ?? initial.description}
              invalid={!!errors?.description}
              aria-describedby={errors?.description ? "description-error" : undefined}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Subteam" htmlFor="subteam" error={errors?.subteam}>
              {onlySubteam ? (
                <>
                  <input type="hidden" name="subteam" value={onlySubteam.value} />
                  <Input id="subteam" value={onlySubteam.label} readOnly disabled />
                </>
              ) : (
                <Select
                  id="subteam"
                  name="subteam"
                  value={subteam}
                  onChange={(e) => setSubteam(e.target.value as "" | Subteam)}
                  invalid={!!errors?.subteam}
                >
                  {subteamOptions.map((o) => (
                    <option key={o.value || "team"} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Due date" htmlFor="dueDate" error={errors?.dueDate}>
              <Input
                id="dueDate"
                name="dueDate"
                type="date"
                required
                min={minDate}
                max={maxDate}
                defaultValue={values?.dueDate ?? initial.dueDate}
                invalid={!!errors?.dueDate}
                aria-describedby={errors?.dueDate ? "dueDate-error" : undefined}
              />
            </Field>
            <Field label="Priority" htmlFor="priority" error={errors?.priority}>
              <Select id="priority" name="priority" defaultValue={values?.priority ?? initial.priority} invalid={!!errors?.priority}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {movedAway && initial.subteam && (
            <Alert tone="warning">
              This task currently belongs to {SUBTEAM_LABELS[initial.subteam]}. Saving moves it to{" "}
              {subteamOptions.find((o) => o.value === subteam)?.label ?? "your subteam"}.
            </Alert>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <AssigneePicker
            groups={groups}
            defaultSelected={initial.assigneeIds}
            taskSubteam={onlySubteam ? undefined : subteam}
            error={errors?.assigneeIds}
            onSelectionChange={setSelected}
          />
          {mode === "edit" &&
            (removedCount > 0 ? (
              <Alert tone="warning" title={`${removedCount} ${removedCount === 1 ? "person" : "people"} will be removed`}>
                Saving deletes their checklist item for this task, including anything they already submitted.
              </Alert>
            ) : (
              <p className="text-xs text-ink-500">
                Unchecking someone removes the task from their checklist (and deletes anything they submitted for it).
              </p>
            ))}
        </CardBody>
      </Card>

      <FormMessage state={state} />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <ButtonLink href={cancelHref} variant="secondary" className="sm:w-auto">
          Cancel
        </ButtonLink>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {mode === "create"
            ? pending
              ? "Creating…"
              : `Create task${selected.size ? ` for ${selected.size}` : ""}`
            : pending
              ? "Saving…"
              : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
