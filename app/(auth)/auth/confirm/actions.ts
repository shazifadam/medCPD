"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { parseLinkType, safeNextPath } from "@/lib/auth/links";

/**
 * Redeems the emailed one-time link. Runs only on the interstitial's POST,
 * so a mail scanner's GET prefetch can no longer consume the token
 * (root cause of the "reset link just goes to login" reports, 2026-10-13).
 */
export async function confirmEmailLinkAction(formData: FormData) {
  const tokenHash = formData.get("token_hash");
  const type = parseLinkType(formData.get("type"));
  const next = safeNextPath(formData.get("next"));

  if (typeof tokenHash !== "string" || !tokenHash || !type) {
    redirect("/login?error=link_expired");
  }

  const { error } = await auth.verifyEmailLink(tokenHash, type);
  if (error) {
    redirect("/login?error=link_expired");
  }
  redirect(next);
}
