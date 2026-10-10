import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { AuthProvider, AuthUser } from "./types";

/**
 * Supabase Auth implementation of the AuthProvider interface.
 * The Supabase client is used for AUTH ONLY — data queries go through
 * postgres-js (lib/db.ts). Server-side (route handlers / server components).
 */

function supabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — middleware refreshes sessions
          }
        },
      },
    }
  );
}

/**
 * Service-role client for admin operations (no cookies, no session). Only
 * used for operations the anon client cannot perform, such as changing
 * another user's email. Never exposed to the browser.
 */
function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export const auth: AuthProvider = {
  async getUser(): Promise<AuthUser | null> {
    const { data, error } = await supabase().auth.getUser();
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? "" };
  },

  async signIn(email, password) {
    const { error } = await supabase().auth.signInWithPassword({
      email,
      password,
    });
    return { error: error?.message ?? null };
  },

  async signInWithMagicLink(email) {
    const { error } = await supabase().auth.signInWithOtp({ email });
    return { error: error?.message ?? null };
  },

  async signUp(email, password) {
    const { error } = await supabase().auth.signUp({ email, password });
    return { error: error?.message ?? null };
  },

  async signUpWithEmailLink(email, metadata, redirectTo) {
    // signInWithOtp with shouldCreateUser creates the auth.users row
    // immediately (fires handle_new_user → profiles) and emails the link.
    const { error } = await supabase().auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        data: metadata,
        emailRedirectTo: redirectTo,
      },
    });
    return { error: error?.message ?? null };
  },

  async sendPasswordReset(email, redirectTo) {
    const { error } = await supabase().auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    return { error: error?.message ?? null };
  },

  async updatePassword(password) {
    const { error } = await supabase().auth.updateUser({ password });
    return { error: error?.message ?? null };
  },

  async updateUserEmail(userId, email) {
    // Admin update: changes the address directly (no change-confirmation
    // email pair). Confirmation status is left as it was; the caller sends
    // the verification link to the new address.
    const { error } = await supabaseAdmin().auth.admin.updateUserById(userId, {
      email,
    });
    return { error: error?.message ?? null };
  },

  async signOut() {
    // scope local: end THIS session only — signing out on one device must
    // not revoke the practitioner's other devices (default scope is global).
    await supabase().auth.signOut({ scope: "local" });
  },
};
