import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/features/auth/forgot-password-form";

export const metadata: Metadata = { title: "Reset your password" };

// AU7 — Forgot password (Figma 287:1349)
export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
