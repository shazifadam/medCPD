"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { getIdentity } from "@/lib/auth/identity";
import { resolveOrganization } from "@/lib/orgs";
import { uploadFile } from "@/lib/storage";

const AVATARS_BUCKET = "cpd-avatars";
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR = ["image/png", "image/jpeg", "image/webp"];

export type ProfileActionState = {
  status: "idle" | "success" | "error";
  error: string | null;
};

const err = (error: string): ProfileActionState => ({ status: "error", error });
const ok: ProfileActionState = { status: "success", error: null };

/** U1-PF1 — save phone + primary workplace (+ optional new photo). */
export async function updateProfileAction(
  _prev: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const identity = await getIdentity();
  if (!identity) return err("Not signed in.");
  const userId = identity.user.id;

  const phone = String(formData.get("phone") ?? "").trim();
  const primaryWorkplace = String(formData.get("primaryWorkplace") ?? "");
  const photo = formData.get("photo");

  if (phone && !/^\+?[0-9 ()-]{6,20}$/.test(phone)) {
    return err("Enter a valid contact number.");
  }

  let primaryId: string | null = null;
  if (primaryWorkplace) {
    primaryId = await resolveOrganization(primaryWorkplace, userId);
    if (!primaryId) return err("Select or create your primary workplace.");
  }

  let avatarPath: string | null = null;
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > MAX_AVATAR_BYTES) return err("Photo too large (max 5 MB).");
    if (!ALLOWED_AVATAR.includes(photo.type))
      return err("Photo must be a PNG, JPG or WebP image.");
    avatarPath = `${userId}/${crypto.randomUUID()}.${photo.type.split("/")[1]}`;
    await uploadFile(
      AVATARS_BUCKET,
      avatarPath,
      Buffer.from(await photo.arrayBuffer()),
      photo.type
    );
  }

  await sql`
    update profiles
    set phone = ${phone || null},
        primary_institution_id = coalesce(${primaryId}, primary_institution_id),
        avatar_path = coalesce(${avatarPath}, avatar_path)
    where id = ${userId}
  `;
  if (primaryId) {
    await sql`
      insert into practitioner_workplaces (practitioner_id, institution_id)
      values (${userId}, ${primaryId})
      on conflict do nothing
    `;
  }

  revalidatePath("/profile");
  return ok;
}

/** Add an "other workplace" chip (select-or-create). */
export async function addWorkplaceAction(
  raw: string
): Promise<ProfileActionState> {
  const identity = await getIdentity();
  if (!identity) return err("Not signed in.");
  const orgId = await resolveOrganization(raw, identity.user.id);
  if (!orgId) return err("Select or create a workplace.");
  await sql`
    insert into practitioner_workplaces (practitioner_id, institution_id)
    values (${identity.user.id}, ${orgId})
    on conflict do nothing
  `;
  revalidatePath("/profile");
  return ok;
}

/** Remove a workplace chip (never the primary). */
export async function removeWorkplaceAction(
  institutionId: string
): Promise<ProfileActionState> {
  const identity = await getIdentity();
  if (!identity) return err("Not signed in.");
  await sql`
    delete from practitioner_workplaces
    where practitioner_id = ${identity.user.id}
      and institution_id = ${institutionId}
      and institution_id is distinct from
          (select primary_institution_id from profiles where id = ${identity.user.id})
  `;
  revalidatePath("/profile");
  return ok;
}
