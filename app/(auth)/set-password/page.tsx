import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SetPasswordForm } from "@/components/features/auth/set-password-form";

export const metadata: Metadata = { title: "Set a new password" };

// AU8 — Reset password (Figma 287:1352). Reached from the emailed link
// (signup verification or password reset) — requires the link session.
export default async function SetPasswordPage() {
  const user = await auth.getUser();
  if (!user) redirect("/login?error=link_expired");

  return <SetPasswordForm />;
}
