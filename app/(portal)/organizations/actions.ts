"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { getIdentity } from "@/lib/auth/identity";
import { canOperateFramework } from "@/lib/framework-admin";
import { ORG_TYPE_KEYS } from "@/lib/org-types";

export type OrgVerifyState = { status: "idle" | "success" | "error"; error: string | null };

/** Mark an organization as a verified/accredited provider (admin + committee). */
export async function verifyOrganizationAction(
  institutionId: string
): Promise<OrgVerifyState> {
  const identity = await getIdentity();
  if (!identity || !canOperateFramework(identity)) {
    return { status: "error", error: "Not authorized." };
  }
  const rows = await sql<{ id: string }[]>`
    update institutions
    set is_verified = true,
        verified_at = now(),
        verified_by = ${identity.user.id}
    where id = ${institutionId} and not is_verified
    returning id
  `;
  if (rows.length === 0) {
    return { status: "error", error: "Organization is already verified." };
  }
  revalidatePath("/organizations");
  return { status: "success", error: null };
}

/** Update name/type (admin + committee). */
export async function updateOrganizationAction(
  institutionId: string,
  input: { name: string; type: string }
): Promise<OrgVerifyState> {
  const identity = await getIdentity();
  if (!identity || !canOperateFramework(identity)) {
    return { status: "error", error: "Not authorized." };
  }
  const name = input.name.trim();
  if (name.length < 2) {
    return { status: "error", error: "Organization name is required." };
  }
  if (!ORG_TYPE_KEYS.includes(input.type) && input.type !== "polyclinic") {
    return { status: "error", error: "Choose a valid organization type." };
  }
  await sql`
    update institutions
    set name = ${name}, type = ${input.type}::institution_type
    where id = ${institutionId}
  `;
  revalidatePath("/organizations");
  return { status: "success", error: null };
}

/**
 * Archive (soft): hides the organization from every selection menu and
 * the active list. Existing references — workplaces, events — keep it.
 */
export async function archiveOrganizationAction(
  institutionId: string
): Promise<OrgVerifyState> {
  const identity = await getIdentity();
  if (!identity || !canOperateFramework(identity)) {
    return { status: "error", error: "Not authorized." };
  }
  await sql`update institutions set is_active = false where id = ${institutionId}`;
  revalidatePath("/organizations");
  return { status: "success", error: null };
}

/** Restore an archived organization to the active list. */
export async function restoreOrganizationAction(
  institutionId: string
): Promise<OrgVerifyState> {
  const identity = await getIdentity();
  if (!identity || !canOperateFramework(identity)) {
    return { status: "error", error: "Not authorized." };
  }
  await sql`update institutions set is_active = true where id = ${institutionId}`;
  revalidatePath("/organizations");
  return { status: "success", error: null };
}
