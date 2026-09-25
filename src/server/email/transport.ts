import nodemailer from "nodemailer";
import type { Db } from "../db";
import { env } from "../env";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Notification type, for the email log. */
  kind: string;
}

export interface EmailTransport {
  readonly name: string;
  /** Throws on failure. */
  send(message: EmailMessage): Promise<void>;
}

class SmtpTransport implements EmailTransport {
  readonly name = "smtp";
  private transporter;
  constructor(cfg: NonNullable<typeof env.smtp>) {
    this.transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
      pool: true,
      maxConnections: 3,
    });
  }
  async send(m: EmailMessage) {
    await this.transporter.sendMail({ from: env.emailFrom, to: m.to, subject: m.subject, text: m.text, html: m.html });
  }
}

class ResendTransport implements EmailTransport {
  readonly name = "resend";
  constructor(private apiKey: string) {}
  async send(m: EmailMessage) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.emailFrom, to: [m.to], subject: m.subject, text: m.text, html: m.html }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

let cached: EmailTransport | null | undefined;

/** The configured transport, or null when email isn't set up (emails are then only logged). */
export function getTransport(): EmailTransport | null {
  if (cached !== undefined) return cached;
  const smtp = env.smtp;
  if (smtp) cached = new SmtpTransport(smtp);
  else if (env.resendApiKey) cached = new ResendTransport(env.resendApiKey);
  else cached = null;
  return cached;
}

/**
 * Send one email and record it in EmailLog. Never throws.
 * With no transport configured the email is printed to the server console and logged as SKIPPED.
 */
export async function sendEmail(
  db: Db,
  message: EmailMessage,
  transport: EmailTransport | null = getTransport(),
): Promise<"SENT" | "FAILED" | "SKIPPED"> {
  let status: "SENT" | "FAILED" | "SKIPPED" = "SENT";
  let error: string | null = null;
  if (!transport) {
    status = "SKIPPED";
    if (!env.isProduction) {
      console.info(`\n[email:dev] to=${message.to} kind=${message.kind}\nSubject: ${message.subject}\n${message.text}\n`);
    }
  } else {
    try {
      await transport.send(message);
    } catch (e) {
      status = "FAILED";
      error = e instanceof Error ? e.message.slice(0, 1000) : String(e).slice(0, 1000);
      console.error(`[email] failed to send ${message.kind} to ${message.to}:`, error);
    }
  }
  try {
    await db.emailLog.create({
      data: { to: message.to, subject: message.subject.slice(0, 300), kind: message.kind, status, error },
    });
  } catch (e) {
    console.error("[email] could not write EmailLog", e);
  }
  return status;
}
