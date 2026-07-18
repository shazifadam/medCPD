import "server-only";
import { sql } from "@/lib/db";
import { auth } from "./supabase";
import type { AuthUser, Role } from "./types";

/**
 * Server-side identity resolution.
 *
 * Auth identity (who is logged in) comes from Supabase Auth via the auth
 * seam. Authorization facts (registration approval state + granted roles)
 * come from our own tables through postgres-js (Stack discipline #3) — never
 * the Supabase client. Keep this out of Edge middleware: postgres-js needs
 * the Node runtime. Middleware handles the session; the (portal) layout calls
 * this to gate on approval + role.
 */

export type RegistrationState = "pending" | "verified" | "rejected";

export interface Identity {
  user: AuthUser;
  fullName: string;
  registrationState: RegistrationState;
  roles: Role[];
}

/** Full identity for the current session, or null when signed out. */
export async function getIdentity(): Promise<Identity | null> {
  const user = await auth.getUser();
  if (!user) return null;

  const profileRows = await sql<
    { registration_state: RegistrationState; full_name: string }[]
  >`
    select registration_state, full_name
    from profiles
    where id = ${user.id}
    limit 1
  `;
  // No profile row yet (trigger lag / just-created) → treat as pending.
  const registrationState = profileRows[0]?.registration_state ?? "pending";
  const fullName = profileRows[0]?.full_name ?? "";

  const roleRows = await sql<{ role: Role }[]>`
    select role
    from role_assignments
    where user_id = ${user.id}
      and revoked_at is null
  `;

  return {
    user,
    fullName,
    registrationState,
    roles: roleRows.map((r) => r.role),
  };
}

/** "Shazif Adam" → "SA"; falls back to the email's first letter. */
export function initialsFor(identity: Identity): string {
  const parts = identity.fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return identity.user.email.charAt(0).toUpperCase() || "?";
  }
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toUpperCase();
}

export function hasRole(identity: Identity | null, role: Role): boolean {
  return identity?.roles.includes(role) ?? false;
}

/** Highest-privilege landing area for a set of roles (post-login redirect). */
export function homePathForRoles(roles: Role[]): string {
  if (roles.includes("mma_admin")) return "/admin";
  if (roles.includes("cpd_committee")) return "/committee";
  return "/dashboard";
}
