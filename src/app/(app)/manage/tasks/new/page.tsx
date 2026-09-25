import type { Metadata } from "next";
import { BackLink } from "@/components/tasks/back-link";
import { TaskForm } from "@/components/tasks/task-form";
import { PageHeader } from "@/components/ui/page-header";
import { addDays, todayInTimezone } from "@/lib/dates";
import { requireStaffUser } from "@/server/auth/session";
import { env } from "@/server/env";
import { getAssignableUsers, getTaskDuplicate, getTaskFormOptions } from "@/server/queries/tasks";
import { DUE_DATE_MAX_FUTURE_DAYS, DUE_DATE_MAX_PAST_DAYS } from "@/server/services/tasks";
import { createTaskAction } from "../actions";

export const metadata: Metadata = { title: "New task" };

export default async function NewTaskPage({ searchParams }: PageProps<"/manage/tasks/new">) {
  const actor = await requireStaffUser();
  const sp = await searchParams;
  const from = typeof sp.from === "string" ? sp.from : undefined;
  const today = todayInTimezone(env.teamTimezone);
  const options = getTaskFormOptions(actor);
  // ?from=<taskId> copies a task the actor manages ("Duplicate"); anything else is ignored.
  const [groups, copy] = await Promise.all([getAssignableUsers(actor), from ? getTaskDuplicate(actor, from, { today }) : null]);

  return (
    <>
      <BackLink href={copy ? `/manage/tasks/${copy.sourceId}` : "/manage/tasks"}>{copy ? "Back to task" : "Tasks"}</BackLink>
      <PageHeader
        title={copy ? "Duplicate task" : "New task"}
        description={
          copy ? (
            <span className="break-words">
              Copy of “{copy.sourceTitle}”, due today. Check the date and people, then create it.
            </span>
          ) : (
            "Everyone you pick gets it on their checklist."
          )
        }
      />
      <TaskForm
        // Remount when switching between a blank form and a copy (the form keeps its own state).
        key={copy?.sourceId ?? "blank"}
        action={createTaskAction}
        mode="create"
        initial={
          copy
            ? {
                title: copy.title,
                description: copy.description,
                subteam: copy.subteam,
                dueDate: copy.dueDate,
                priority: copy.priority,
                assigneeIds: copy.assigneeIds,
              }
            : {
                title: "",
                description: "",
                subteam: options.defaultSubteam,
                dueDate: today,
                priority: "NORMAL",
                assigneeIds: [],
              }
        }
        subteamOptions={options.subteams}
        groups={groups}
        minDate={addDays(today, -DUE_DATE_MAX_PAST_DAYS)}
        maxDate={addDays(today, DUE_DATE_MAX_FUTURE_DAYS)}
        cancelHref={copy ? `/manage/tasks/${copy.sourceId}` : "/manage/tasks"}
      />
    </>
  );
}
