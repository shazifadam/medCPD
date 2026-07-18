/**
 * Thin auth interface (Stack discipline #3).
 * Application code depends on this shape only — the Supabase Auth
 * implementation lives behind it (lib/auth/supabase.ts). Swapping to
 * Auth.js / Lucia on the fallback stack replaces one file.
 */

export type Role =
  | "practitioner"
  | "cpd_committee"
  | "mma_admin"
  | "organizer";

export interface AuthUser {
  id: string;
  email: string;
}

export interface Session {
  user: AuthUser;
}

/** Signup metadata carried to the DB profile via the handle_new_user trigger. */
export interface SignUpMetadata {
  full_name: string;
  phone: string;
  mmdc_registration: string;
  mmdc_registration_type: "PMR" | "TMR";
}

export interface AuthProvider {
  /** Current authenticated user, or null. Server-side. */
  getUser(): Promise<AuthUser | null>;
  /** Email + password sign-in. */
  signIn(email: string, password: string): Promise<{ error: string | null }>;
  /** Magic-link sign-in. */
  signInWithMagicLink(email: string): Promise<{ error: string | null }>;
  /** Email + password sign-up. */
  signUp(email: string, password: string): Promise<{ error: string | null }>;
  /**
   * Passwordless account creation (AU3, decision 2026-07-04): creates the
   * user with metadata and emails a verification link (AU6). The user sets
   * a password on AU8 after clicking it.
   */
  signUpWithEmailLink(
    email: string,
    metadata: SignUpMetadata,
    redirectTo: string
  ): Promise<{ error: string | null }>;
  /** AU7 — email a password-reset link (lands on AU8). */
  sendPasswordReset(
    email: string,
    redirectTo: string
  ): Promise<{ error: string | null }>;
  /** AU8 — set a new password for the current (link-authenticated) session. */
  updatePassword(password: string): Promise<{ error: string | null }>;
  signOut(): Promise<void>;
}
