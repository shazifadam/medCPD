import type { Metadata } from "next";
import { LoginForm } from "@/components/features/auth/login-form";
import { AuthCard } from "@/components/features/auth/auth-card";

export const metadata: Metadata = { title: "Sign in" };

// AU1 — Login, default · AU2 — Login, error (Figma 287:1331 / 287:1334)
export default function LoginPage() {
  return (
    <AuthCard>
      <LoginForm />
    </AuthCard>
  );
}
