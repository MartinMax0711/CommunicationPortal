// Centralised, typed access to runtime configuration.

function list(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export const env = {
  get appUrl(): string {
    // VERCEL_PROJECT_PRODUCTION_URL is the stable production domain; VERCEL_URL changes every deploy.
    const raw =
      process.env.APP_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    return raw.replace(/\/+$/, "");
  },
  get teamTimezone(): string {
    return process.env.TEAM_TIMEZONE || "America/Los_Angeles";
  },
  get adminEmails(): string[] {
    return list(process.env.ADMIN_EMAILS);
  },
  get teamJoinCode(): string | null {
    const code = process.env.TEAM_JOIN_CODE?.trim();
    return code ? code : null;
  },
  get emailFrom(): string {
    return process.env.EMAIL_FROM || "Huskyteers Portal <no-reply@example.com>";
  },
  get smtp() {
    const host = process.env.SMTP_HOST?.trim();
    if (!host) return null;
    const port = Number(process.env.SMTP_PORT || 465);
    return {
      host,
      port,
      secure: port === 465,
      user: process.env.SMTP_USER ?? "",
      pass: process.env.SMTP_PASS ?? "",
    };
  },
  get resendApiKey(): string | null {
    return process.env.RESEND_API_KEY?.trim() || null;
  },
  get isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  },
};
