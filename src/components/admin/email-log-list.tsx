import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { EmailStatus } from "@/generated/prisma/enums";
import { formatDateTime } from "@/lib/dates";
import type { EmailLogItem } from "@/server/queries/admin";

const STATUS: Record<EmailStatus, { label: string; tone: BadgeTone }> = {
  SENT: { label: "Sent", tone: "green" },
  FAILED: { label: "Failed", tone: "red" },
  SKIPPED: { label: "Logged only", tone: "gray" },
};

export function EmailStatusBadge({ status }: { status: EmailStatus }) {
  const s = STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function EmailLogList({ logs, timeZone }: { logs: EmailLogItem[]; timeZone: string }) {
  return (
    <Card>
      <ul className="divide-y divide-ink-100">
        {logs.map((l) => (
          <li key={l.id} className="space-y-1.5 px-4 py-3 sm:px-5">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 break-words text-sm font-medium text-ink-900">{l.subject}</p>
              <EmailStatusBadge status={l.status} />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
              <span className="min-w-0 break-all">To {l.to}</span>
              <code className="rounded bg-ink-100 px-1 py-0.5 font-mono text-[11px] text-ink-700">{l.kind}</code>
              <time dateTime={l.createdAt.toISOString()} className="whitespace-nowrap">
                {formatDateTime(l.createdAt, timeZone)}
              </time>
            </div>
            {l.error && (
              <p className="break-words rounded-md bg-red-50 px-2 py-1.5 font-mono text-xs text-red-800">{l.error}</p>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
