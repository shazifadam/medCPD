"use server";

import { auth } from "@/lib/auth";
import { getIdentity } from "@/lib/auth/identity";

export type SettingsActionState = {
  status: "idle" | "success" | "error";
  error: string | null;
};

/** D-ST1 — change the signed-in user's password. */
export async function changePasswordAction(
  _prev: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const identity = await getIdentity();
  if (!identity) return { status: "error", error: "Not signed in." };

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) {
    return {
      status: "error",
      error: "Password must be at least 8 characters.",
    };
  }
  if (password !== confirm) {
    return { status: "error", error: "Passwords do not match." };
  }

  const { error } = await auth.updatePassword(password);
  if (error) return { status: "error", error };
  return { status: "success", error: null };
}
