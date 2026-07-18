import type { Metadata } from "next";
import { sql } from "@/lib/db";
import { SignUpForm, type SpecialtyOption } from "@/components/features/auth/signup-form";

export const metadata: Metadata = { title: "Create your account" };
// Reads the specialties lookup per request — never at build time.
export const dynamic = "force-dynamic";

// AU3 — Sign up, form · AU4 — validation error · AU5 — success
// (Figma 287:1337 / 287:1340 / 287:1343)
export default async function SignUpPage() {
  const specialties = await sql<SpecialtyOption[]>`
    select id, name
    from specialties
    where is_active
    order by display_order, name
  `;

  return <SignUpForm specialties={specialties} />;
}
