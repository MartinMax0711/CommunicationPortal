import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { EmailConfigStatus } from "@/server/queries/admin";
import { TestEmailForm } from "./test-email-form";

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-ink-100 px-1 py-0.5 font-mono text-[0.8em] text-ink-800">{children}</code>;
}

const MODE_LABEL: Record<EmailConfigStatus["mode"], string> = {
  smtp: "SMTP",
  resend: "Resend",
  none: "Not set up",
};

/** Which provider is configured, how to set one up, and a test button. Never shows secrets. */
export function EmailConfigCard({ config, adminEmail }: { config: EmailConfigStatus; adminEmail: string }) {
  const configured = config.mode !== "none";
  return (
    <Card>
      <CardHeader
        title="Email setup"
        description={config.detail}
        actions={<Badge tone={configured ? "green" : "yellow"}>{MODE_LABEL[config.mode]}</Badge>}
      />
      <CardBody className="space-y-5">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
          <dt className="text-ink-500">Sender</dt>
          <dd className="min-w-0 break-words font-medium text-ink-900">{config.from}</dd>
          <dt className="text-ink-500">Links point to</dt>
          <dd className="min-w-0 break-words font-medium text-ink-900">{config.appUrl}</dd>
          <dt className="text-ink-500">Admin emails</dt>
          <dd className="min-w-0 break-words font-medium text-ink-900">
            {config.adminEmails.length ? config.adminEmails.join(", ") : <span className="font-normal text-ink-500">None listed</span>}
          </dd>
        </dl>

        <TestEmailForm email={adminEmail} />

        <details className="group rounded-lg border border-ink-200 bg-ink-50/60 text-sm" open={!configured}>
          <summary className="flex min-h-10 cursor-pointer list-none items-center px-3 py-2 font-medium text-ink-800 [&::-webkit-details-marker]:hidden">
            How to set up email
          </summary>
          <div className="space-y-3 border-t border-ink-200 px-3 py-3 leading-relaxed text-ink-700">
            <p>
              Set these environment variables on your host (or in <Code>.env</Code> locally), then restart or redeploy.
            </p>
            <div>
              <p className="font-medium text-ink-900">Option A — any SMTP server (e.g. Gmail)</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>
                  <Code>SMTP_HOST</Code> = <Code>smtp.gmail.com</Code>, <Code>SMTP_PORT</Code> = <Code>465</Code>
                </li>
                <li>
                  <Code>SMTP_USER</Code> = your Gmail address, <Code>SMTP_PASS</Code> = a Gmail{" "}
                  <span className="font-medium">App Password</span> (Google Account → Security → 2-Step Verification →
                  App passwords), not your normal password
                </li>
                <li>
                  <Code>EMAIL_FROM</Code> = e.g. <Code>Huskyteers Portal &lt;you@gmail.com&gt;</Code> (Gmail requires your own
                  address)
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-ink-900">Option B — Resend</p>
              <p>
                Set <Code>RESEND_API_KEY</Code> and an <Code>EMAIL_FROM</Code> on a domain you verified with Resend.
              </p>
            </div>
            <div>
              <p className="font-medium text-ink-900">Also</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>
                  <Code>APP_URL</Code> — the public address of the portal, used for links in emails.
                </li>
                <li>
                  <Code>ADMIN_EMAILS</Code> — comma-separated; these people become admins when they register.
                </li>
              </ul>
            </div>
            <p className="text-ink-500">Without a provider, emails are only written to the log below (fine for testing).</p>
          </div>
        </details>
      </CardBody>
    </Card>
  );
}
