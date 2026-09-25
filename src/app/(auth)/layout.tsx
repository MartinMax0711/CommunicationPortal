import { Logo } from "@/components/brand/logo";

export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col items-center bg-brand-100/60 px-4 py-10 sm:justify-center">
      <div className="mb-8">
        <Logo size="lg" />
      </div>
      <div className="w-full max-w-md rounded-2xl border border-brand-200 bg-white p-6 shadow-sm sm:p-8">{children}</div>
      <p className="mt-6 text-center text-xs text-ink-500">FTC Team 19516 · Team Portal</p>
    </div>
  );
}
