"use client";

import { useFormStatus } from "react-dom";
import { KeyRound, Loader2, Mail } from "lucide-react";
import type { EmailLinkType } from "@/lib/auth";
import { linkCopy } from "@/lib/auth/links";
import { confirmEmailLinkAction } from "@/app/(auth)/auth/confirm/actions";
import { Button } from "@/components/ui/button";
import { AuthCard } from "./auth-card";

/**
 * AU6-style interstitial card for an emailed link. A plain form POST (no
 * auto-submit on load) so only a real click redeems the one-time token.
 */
export function ConfirmLinkCard({
  tokenHash,
  type,
  next,
}: {
  tokenHash: string;
  type: EmailLinkType;
  next: string;
}) {
  const copy = linkCopy(type);
  const Icon = type === "recovery" ? KeyRound : Mail;

  return (
    <AuthCard className="max-w-[400px]">
      <form
        action={confirmEmailLinkAction}
        className="flex flex-col items-center gap-4 text-center"
      >
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="next" value={next} />
        <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-primary text-primary">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-lg font-semibold text-foreground">{copy.title}</h1>
          <p className="text-sm text-muted-foreground">{copy.body}</p>
        </div>
        <SubmitButton label={copy.button} pendingLabel={copy.pendingLabel} />
        <p className="text-xs text-muted-foreground">
          This link can only be used once and expires after an hour.
        </p>
      </form>
    </AuthCard>
  );
}

function SubmitButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {pendingLabel}
        </>
      ) : (
        label
      )}
    </Button>
  );
}
