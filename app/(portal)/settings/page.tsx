import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getIdentity } from "@/lib/auth/identity";
import { ChangePasswordForm } from "@/components/features/settings/change-password-form";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

/** D-ST1 — account settings (navbar cog): security / password reset. */
export default async function SettingsPage() {
  const identity = await getIdentity();
  if (!identity) redirect("/login");

  return (
    <div className="mx-auto flex max-w-[700px] flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Account and security preferences
        </p>
      </div>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">Account</h2>
        <dl className="mt-3 text-sm">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Signed in as
          </dt>
          <dd className="mt-1 text-foreground">{identity.user.email}</dd>
        </dl>
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">
          Change password
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sets a new password for your account immediately — you stay signed
          in on this device.
        </p>
        <div className="mt-4">
          <ChangePasswordForm />
        </div>
      </section>
    </div>
  );
}
