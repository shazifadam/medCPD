import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getIdentity } from "@/lib/auth/identity";
import { sql } from "@/lib/db";
import { ReapplyForm } from "@/components/features/auth/reapply-form";

export const metadata: Metadata = { title: "Update your application" };

/**
 * /reapply — a rejected practitioner corrects their details and resubmits.
 * No designed frame: deliberate deviation, cloned from the AU3 sign-up
 * anatomy (Figma 294:13161) with the email locked. Session required
 * (middleware); only the `rejected` state may use it.
 */
export default async function ReapplyPage() {
  const identity = await getIdentity();
  if (!identity) redirect("/login");
  if (identity.registrationState === "verified") redirect("/dashboard");
  if (identity.registrationState === "pending") redirect("/pending");

  const rows = await sql<
    {
      full_name: string;
      email: string;
      phone: string | null;
      mmdc_registration: string | null;
      mmdc_registration_type: "PMR" | "TMR" | null;
      rejection_reason: string | null;
    }[]
  >`
    select full_name, email, phone, mmdc_registration,
           mmdc_registration_type, rejection_reason
    from profiles
    where id = ${identity.user.id}
    limit 1
  `;
  const p = rows[0];
  if (!p) redirect("/pending");

  return (
    <ReapplyForm
      fullName={p.full_name}
      email={p.email}
      phone={p.phone}
      mmdcRegistration={p.mmdc_registration}
      mmdcRegistrationType={p.mmdc_registration_type}
      rejectionReason={p.rejection_reason}
    />
  );
}
