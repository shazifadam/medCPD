"use server";

import { forgotPasswordSchema } from "@/lib/schemas";
import { auth } from "@/lib/auth";

export type ForgotPasswordState = {
  status: "idle" | "sent" | "error";
  error: string | null;
};

export async function forgotPasswordAction(
  _prev: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { status: "error", error: "Enter a valid email address." };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  await auth.sendPasswordReset(
    parsed.data.email,
    `${appUrl}/auth/callback?next=/set-password`
  );

  // Always report sent — never reveal whether an account exists.
  return { status: "sent", error: null };
}
