import type { Metadata } from "next";
import { LoginForm } from "@/components/features/auth/login-form";
import { AuthCard } from "@/components/features/auth/auth-card";

export const metadata: Metadata = { title: "Sign in" };

// AU1 — Login, default · AU2 — Login, error (Figma 287:1331 / 287:1334)
// ?error=link_expired arrives from the /auth/confirm + /auth/callback
// bridges when an emailed one-time link is used up or stale; the form shows
// an AU2-style notice with the way out (a fresh link via AU7).
export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <AuthCard>
      <LoginForm linkExpired={searchParams.error === "link_expired"} />
    </AuthCard>
  );
}
