import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthHeader, AuthSwitch } from "@/components/auth/auth-header";
import { RegisterForm } from "@/components/auth/register-form";
import { getCurrentUser } from "@/server/auth/session";
import { env } from "@/server/env";
import { safeRedirectPath } from "@/server/services/auth";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const next = safeRedirectPath((await searchParams).next);
  const user = await getCurrentUser();
  if (user) redirect(user.status === "ACTIVE" ? (next ?? "/today") : "/pending");

  return (
    <>
      <AuthHeader title="Join the team" description="Create your account to get your daily checklist and ask your leaders questions." />
      <RegisterForm next={next} requiresJoinCode={env.teamJoinCode !== null} />
      <AuthSwitch prompt="Already have an account?" href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}>
        Sign in
      </AuthSwitch>
    </>
  );
}
