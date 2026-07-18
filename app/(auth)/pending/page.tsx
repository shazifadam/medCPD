import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Clock, XCircle } from "lucide-react";
import { getIdentity } from "@/lib/auth/identity";
import { signOutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/components/features/auth/auth-card";

export const metadata: Metadata = { title: "Registration pending" };

/**
 * AU6 — Pending approval / AU7 — Rejected.
 * Shown to a signed-in user whose registration_state is not yet 'verified'.
 * A verified user landing here is bounced into the portal; a signed-out user
 * to login. Rendered inside the (auth) centered-card shell.
 */
export default async function PendingPage() {
  const identity = await getIdentity();

  if (!identity) redirect("/login");
  if (identity.registrationState === "verified") redirect("/dashboard");

  const rejected = identity.registrationState === "rejected";

  return (
    <AuthCard className="flex flex-col items-center gap-5 text-center">
      <div
        className={
          rejected
            ? "flex h-12 w-12 items-center justify-center rounded-full bg-status-rejected-bg text-status-rejected"
            : "flex h-12 w-12 items-center justify-center rounded-full bg-status-pending-bg text-status-pending"
        }
      >
        {rejected ? (
          <XCircle className="h-6 w-6" aria-hidden />
        ) : (
          <Clock className="h-6 w-6" aria-hidden />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold text-foreground">
          {rejected ? "Registration not approved" : "Registration under review"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {rejected
            ? "Your registration could not be verified against the MMDC register. Contact the MMA secretariat if you believe this is a mistake."
            : "Thanks for registering. An MMA administrator is verifying your MMDC details. You'll be able to sign in once your account is approved."}
        </p>
      </div>

      <form action={signOutAction} className="w-full">
        <Button type="submit" variant="outline" className="w-full">
          Sign out
        </Button>
      </form>
    </AuthCard>
  );
}
