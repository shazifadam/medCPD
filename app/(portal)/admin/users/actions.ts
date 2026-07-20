"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { getIdentity, hasRole } from "@/lib/auth/identity";

export type UserActionState = {
  status: "idle" | "success" | "error";
  error: string | null;
};

const GRANTABLE = ["practitioner", "organizer", "cpd_committee", "mma_admin"];

/** UM3 — grant or revoke a role. */
export async function setRoleAction(input: {
  userId: string;
  role: string;
  grant: boolean;
}): Promise<UserActionState> {
  const identity = await getIdentity();
  if (!identity || !hasRole(identity, "mma_admin")) {
    return { status: "error", error: "Not authorized." };
  }
  if (!GRANTABLE.includes(input.role)) {
    return { status: "error", error: "Unknown role." };
  }
  if (input.userId === identity.user.id && input.role === "mma_admin" && !input.grant) {
    return { status: "error", error: "You can't revoke your own admin role." };
  }

  if (input.grant) {
    await sql`
      insert into role_assignments (user_id, role, granted_by)
      select ${input.userId}, ${input.role}::user_role, ${identity.user.id}
      where not exists (
        select 1 from role_assignments
        where user_id = ${input.userId}
          and role = ${input.role}::user_role
          and revoked_at is null
      )
    `;
  } else {
    await sql`
      update role_assignments
      set revoked_at = now(), revoked_by = ${identity.user.id},
          revoke_reason = 'Revoked by admin'
      where user_id = ${input.userId}
        and role = ${input.role}::user_role
        and revoked_at is null
    `;
  }

  revalidatePath("/admin/users");
  return { status: "success", error: null };
}

/** OG2 — register an organization. */
export async function createOrganizationAction(input: {
  name: string;
  type: string;
}): Promise<UserActionState> {
  const identity = await getIdentity();
  if (!identity || !hasRole(identity, "mma_admin")) {
    return { status: "error", error: "Not authorized." };
  }
  const name = input.name.trim();
  if (name.length < 2) {
    return { status: "error", error: "Organization name is required." };
  }

  await sql`
    insert into institutions (name, type, is_verified, verified_at, verified_by)
    values (${name}, ${input.type}::institution_type, true, now(), ${identity.user.id})
  `;

  revalidatePath("/admin/organizations");
  return { status: "success", error: null };
}
