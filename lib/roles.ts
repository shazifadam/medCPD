/**
 * Grantable roles — the `user_role` enum minus `institution_admin`, which is
 * bound to an institution scope and is not handed out from the admin UI.
 *
 * Shared by UM3 (manage roles) and RA3 (approve registration) so the two
 * surfaces can never drift apart.
 */

export interface RoleOption {
  key: string;
  label: string;
  /** UM3 checkbox caption. */
  hint: string;
  /** RA3 "Grants …" summary line. */
  grants: string;
}

export const GRANTABLE_ROLES: RoleOption[] = [
  {
    key: "practitioner",
    label: "Practitioner",
    hint: "Log CPD, attend events",
    grants: "full access to the CPD portal",
  },
  {
    key: "organizer",
    label: "Organizer",
    hint: "Create and run events",
    grants: "creating and running events",
  },
  {
    key: "cpd_committee",
    label: "CPD Committee",
    hint: "Review entries and accredit events",
    grants: "reviewing entries and accrediting events",
  },
  {
    key: "mma_admin",
    label: "Super Admin",
    hint: "Full system access",
    grants: "full system access",
  },
];

/** What a new registration gets unless the admin picks otherwise. */
export const DEFAULT_GRANT_ROLE = "practitioner";

export function isGrantableRole(value: unknown): value is string {
  return (
    typeof value === "string" && GRANTABLE_ROLES.some((r) => r.key === value)
  );
}

export function roleLabel(key: string): string {
  return GRANTABLE_ROLES.find((r) => r.key === key)?.label ?? key;
}
