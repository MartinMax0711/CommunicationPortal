import { after } from "next/server";
import { prisma } from "../db";
import { deliverNotification } from "./deliver";
import type { NotificationEvent, Notifier } from "./events";

export type { NotificationEvent, Notifier } from "./events";

/**
 * Production notifier: sends after the response is flushed (so saving a task never waits on SMTP),
 * and swallows errors so a mail outage can't break the app.
 */
export const appNotifier: Notifier = {
  notify(event: NotificationEvent) {
    const run = async () => {
      try {
        await deliverNotification(prisma, event);
      } catch (e) {
        console.error(`[notify] ${event.type} failed`, e);
      }
    };
    try {
      after(run);
    } catch {
      // Outside a request scope (scripts): send inline.
      void run();
    }
  },
};
