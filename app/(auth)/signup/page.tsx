import type { Metadata } from "next";
import { SignUpForm } from "@/components/features/auth/signup-form";

export const metadata: Metadata = { title: "Create your account" };
export const dynamic = "force-dynamic";

// AU3 — Sign up, form · AU4 — validation error · AU5 — success
// (Figma 287:1337 / 287:1340 / 287:1343). Specialty + primary workplace
// moved to the profile page on 2026-09-08 (client directive) — the form
// no longer needs the specialties/organizations lookups.
export default function SignUpPage() {
  return <SignUpForm />;
}
