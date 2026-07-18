"use server";

import { redirect } from "next/navigation";
import { setPasswordSchema } from "@/lib/schemas";
import { auth } from "@/lib/auth";
import { getIdentity, homePathForRoles } from "@/lib/auth/identity";

export type SetPasswordState = { error: string | null };

export async function setPasswordAction(
  _prev: SetPasswordState,
  formData: FormData
): Promise<SetPasswordState> {
  const parsed = setPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: "Please correct the highlighted fields." };
  }

  const { error } = await auth.updatePassword(parsed.data.password);
  if (error) {
    // e.g. "New password should be different from the old password."
    return { error };
  }

  // Same routing rule as login: unapproved → pending gate, else by role.
  const identity = await getIdentity();
  if (!identity || identity.registrationState !== "verified") {
    redirect("/pending");
  }
  redirect(homePathForRoles(identity.roles));
}
