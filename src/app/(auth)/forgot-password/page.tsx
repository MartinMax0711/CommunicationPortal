import { KeyRound } from "lucide-react";
import type { Metadata } from "next";
import { AuthHeader, AuthSwitch } from "@/components/auth/auth-header";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeader
        icon={KeyRound}
        title="Forgot password?"
        description="Enter the email you signed up with and we'll send you a link to choose a new one."
      />
      <ForgotPasswordForm />
      <AuthSwitch prompt="Remembered it?" href="/login">
        Back to sign in
      </AuthSwitch>
    </>
  );
}
