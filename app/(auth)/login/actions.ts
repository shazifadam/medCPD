"use server";

import { redirect } from "next/navigation";
import { signInSchema } from "@/lib/schemas";
import { auth } from "@/lib/auth";
import { getIdentity, homePathForRoles } from "@/lib/auth/identity";

export type SignInState = { error: string | null };

export async function signInAction(
  _prev: SignInState,
  formData: FormData
): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    // Client validation should catch this first; server re-validates (shared schema)
    return { error: "Incorrect email or password." };
  }

  let error: string | null;
  try {
    ({ error } = await auth.signIn(parsed.data.email, parsed.data.password));
  } catch {
    // Auth backend unreachable/unconfigured — same generic message
    // (never leak which of email/password/config failed)
    error = "Incorrect email or password.";
  }
  if (error) {
    return { error: "Incorrect email or password." };
  }

  // Route by approval + role. Unapproved users go to the pending gate; the
  // portal layout enforces the same rule for direct navigation.
  const identity = await getIdentity();
  if (!identity || identity.registrationState !== "verified") {
    redirect("/pending");
  }
  redirect(homePathForRoles(identity.roles));
}
