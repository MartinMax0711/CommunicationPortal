"use client";

import { MessageSquare } from "lucide-react";
import { useActionState } from "react";
import { sendDiscordTestAction } from "@/app/(app)/admin/actions";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/action-state";
import { DISCORD_TEST_MESSAGES } from "./messages";

export type DiscordSetup = "connected" | "invalid" | "none";

const BADGE: Record<DiscordSetup, { tone: "green" | "yellow" | "red"; label: string }> = {
  connected: { tone: "green", label: "Connected" },
  invalid: { tone: "red", label: "Check the URL" },
  none: { tone: "yellow", label: "Not set up" },
};

/** Status of the leaders' Discord channel hook + a test button. Never shows the webhook URL. */
export function DiscordCard({ setup }: { setup: DiscordSetup }) {
  const [state, formAction] = useActionState(sendDiscordTestAction, initialActionState);
  const tone = !state ? null : !state.ok ? "error" : state.message === DISCORD_TEST_MESSAGES.SKIPPED ? "warning" : "success";
  const badge = BADGE[setup];

  return (
    <Card>
      <CardHeader
        title="Discord"
        description="New questions and replies are posted, in full, to your leaders-only Discord channel."
        actions={<Badge tone={badge.tone}>{badge.label}</Badge>}
      />
      <CardBody className="space-y-4">
        {setup !== "connected" && (
          <div className="space-y-1.5 text-sm text-ink-700">
            {setup === "invalid" && (
              <p className="text-red-700">DISCORD_WEBHOOK_URL is set but doesn&apos;t look like a Discord webhook link.</p>
            )}
            <p className="font-medium text-ink-900">To connect a channel:</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>In Discord, open the leaders-only channel → Edit Channel → Integrations → Webhooks → New Webhook → Copy Webhook URL.</li>
              <li>In Vercel → Settings → Environment Variables, add <code className="rounded bg-ink-100 px-1 font-mono text-[0.8em]">DISCORD_WEBHOOK_URL</code> with that link.</li>
              <li>Redeploy, then press the button below.</li>
            </ol>
            <p className="text-ink-500">Keep the channel leaders-only: questions are posted in full.</p>
          </div>
        )}
        <form action={formAction} className="space-y-3">
          <SubmitButton variant="secondary" className="w-full sm:w-auto" pendingText="Sending…">
            <MessageSquare className="size-4" aria-hidden />
            Send a test message to Discord
          </SubmitButton>
          {tone && state?.message && <Alert tone={tone}>{state.message}</Alert>}
        </form>
      </CardBody>
    </Card>
  );
}
