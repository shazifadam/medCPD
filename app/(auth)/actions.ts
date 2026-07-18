"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/** Sign out and return to the login screen. Shared across AU screens. */
export async function signOutAction() {
  await auth.signOut();
  redirect("/login");
}
