import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { parseLinkType, safeNextPath } from "@/lib/auth/links";
import { ConfirmLinkCard } from "@/components/features/auth/confirm-link-card";

export const metadata: Metadata = { title: "Confirm your email link" };

// AU6 → AU8 bridge (interstitial). Every branded Supabase email lands here
// with ?token_hash&type&next. The page itself is side-effect free: the
// one-time token is only redeemed when the person presses the button
// (POST). Mail scanners on Outlook / corporate domains prefetch every link
// in an email; redeeming on GET let them burn the token first, so real
// clicks bounced to /login. No dedicated Figma frame — composed from the
// AU5/AU6 card pattern (icon · title · body · primary button).
export default function ConfirmLinkPage({
  searchParams,
}: {
  searchParams: { token_hash?: string; type?: string; next?: string };
}) {
  const tokenHash = searchParams.token_hash;
  const type = parseLinkType(searchParams.type);
  if (!tokenHash || !type) redirect("/login?error=link_expired");

  return (
    <ConfirmLinkCard
      tokenHash={tokenHash}
      type={type}
      next={safeNextPath(searchParams.next)}
    />
  );
}
