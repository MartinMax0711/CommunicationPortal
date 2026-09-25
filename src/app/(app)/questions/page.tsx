import { CircleCheck, Inbox, MessageCircleQuestionMark, Plus } from "lucide-react";
import type { Metadata } from "next";
import { InboxList, MyQuestionList, StatusFilter } from "@/components/questions/question-lists";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkTabs } from "@/components/ui/link-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination, parsePage } from "@/components/ui/pagination";
import type { Actor } from "@/server/actor";
import { requireActiveUser } from "@/server/auth/session";
import { env } from "@/server/env";
import { isStaff } from "@/server/permissions";
import { getNavCounts } from "@/server/queries/nav";
import { type InboxFilter, listInbox, listMyQuestions } from "@/server/queries/questions";

export const metadata: Metadata = { title: "Questions" };

const FILTERS: { key: string; status: InboxFilter; label: string }[] = [
  { key: "open", status: "OPEN", label: "Open" },
  { key: "answered", status: "ANSWERED", label: "Answered" },
  { key: "resolved", status: "RESOLVED", label: "Resolved" },
  { key: "all", status: "all", label: "All" },
];

const INBOX_EMPTY: Record<InboxFilter, { title: string; description: string }> = {
  OPEN: { title: "All caught up", description: "No one is waiting on an answer right now." },
  ANSWERED: { title: "Nothing here", description: "Questions you've answered show up here until the asker resolves them." },
  RESOLVED: { title: "No resolved questions yet", description: "Resolved questions are kept here for reference." },
  all: { title: "No questions yet", description: "When your team asks a question, it lands here." },
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function href(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  const s = qs.toString();
  return s ? `/questions?${s}` : "/questions";
}

const askButton = (
  <ButtonLink href="/questions/new">
    <Plus className="size-4" aria-hidden />
    Ask a question
  </ButtonLink>
);

async function MyQuestionsSection({
  actor,
  page,
  pageHref,
  now,
}: {
  actor: Actor;
  page: number;
  pageHref: (page: number) => string;
  now: Date;
}) {
  const mine = await listMyQuestions(actor, { page });
  if (mine.total === 0) {
    return (
      <Card>
        <EmptyState
          icon={MessageCircleQuestionMark}
          title="No questions yet — ask your leaders anything."
          description="They'll get an email, and you'll get one when they answer."
          action={askButton}
        />
      </Card>
    );
  }
  const fresh = mine.counts.ANSWERED;
  return (
    <>
      {fresh > 0 && (
        <p className="mb-3 text-sm font-medium text-brand-700">
          {fresh === 1 ? "You have a new answer." : `You have ${fresh} new answers.`}
        </p>
      )}
      {mine.items.length > 0 ? (
        <MyQuestionList items={mine.items} now={now} timeZone={env.teamTimezone} />
      ) : (
        <Card>
          <EmptyState title="Nothing on this page" description="Go back to the first page to see your questions." />
        </Card>
      )}
      <Pagination page={mine.page} pageCount={mine.pageCount} hrefFor={pageHref} />
    </>
  );
}

export default async function QuestionsPage({ searchParams }: PageProps<"/questions">) {
  const actor = await requireActiveUser();
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const now = new Date();

  if (!isStaff(actor)) {
    return (
      <>
        <PageHeader title="Questions" description="Stuck on something? Ask your leaders." actions={askButton} />
        <MyQuestionsSection actor={actor} page={page} now={now} pageHref={(n) => href({ page: n > 1 ? n : undefined })} />
      </>
    );
  }

  const tab = first(sp.tab) === "mine" ? "mine" : "inbox";
  const filter = FILTERS.find((f) => f.key === first(sp.status)) ?? FILTERS[0];
  // Same request-cached call the layout already made for the nav badges.
  const counts = await getNavCounts(actor);

  const tabs = (
    <LinkTabs
      className="mb-4"
      tabs={[
        { href: "/questions", label: "Inbox", active: tab === "inbox", count: counts.openQuestions, tone: "alert" },
        { href: href({ tab: "mine" }), label: "My questions", active: tab === "mine", count: counts.answeredForMe, tone: "alert" },
      ]}
    />
  );

  if (tab === "mine") {
    return (
      <>
        <PageHeader title="Questions" description="Answer your team and keep track of what you've asked." actions={askButton} />
        {tabs}
        <MyQuestionsSection
          actor={actor}
          page={page}
          now={now}
          pageHref={(n) => href({ tab: "mine", page: n > 1 ? n : undefined })}
        />
      </>
    );
  }

  const inbox = await listInbox(actor, { status: filter.status, page });
  const filterHref = (key: string, n?: number) =>
    href({ status: key === "open" ? undefined : key, page: n && n > 1 ? n : undefined });
  const empty = INBOX_EMPTY[filter.status];

  return (
    <>
      <PageHeader title="Questions" description="Answer your team and keep track of what you've asked." actions={askButton} />
      {tabs}
      <div className="mb-4">
        <StatusFilter
          items={FILTERS.map((f) => ({
            href: filterHref(f.key),
            label: f.label,
            count: inbox.counts[f.status],
            active: f.key === filter.key,
          }))}
        />
      </div>
      {inbox.items.length > 0 ? (
        <InboxList items={inbox.items} now={now} timeZone={env.teamTimezone} />
      ) : (
        <Card>
          <EmptyState
            icon={filter.status === "OPEN" ? CircleCheck : Inbox}
            title={page > 1 && inbox.total > 0 ? "Nothing on this page" : empty.title}
            description={page > 1 && inbox.total > 0 ? "Go back to the first page." : empty.description}
          />
        </Card>
      )}
      <Pagination page={inbox.page} pageCount={inbox.pageCount} hrefFor={(n) => filterHref(filter.key, n)} />
    </>
  );
}
