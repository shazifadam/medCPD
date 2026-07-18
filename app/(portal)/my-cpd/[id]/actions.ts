"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { sql } from "@/lib/db";
import { getIdentity } from "@/lib/auth/identity";
import { s3 } from "@/lib/storage";

/**
 * EN5/EN7 — withdraw a PENDING entry: hard delete (schema Part 5d — removed
 * attachments are hard-deleted, the row cascade takes the metadata, and the
 * app cleans up the Storage bytes). Approved/rejected entries are immutable
 * here — mistakes route through MMA admin.
 */
export async function withdrawEntryAction(entryId: string): Promise<void> {
  const identity = await getIdentity();
  if (!identity) redirect("/login");

  const attachments = await sql<
    { storage_bucket: string; storage_path: string }[]
  >`
    select a.storage_bucket, a.storage_path
    from cpd_entry_attachments a
    join cpd_entries e on e.id = a.entry_id
    where e.id = ${entryId}
      and e.practitioner_id = ${identity.user.id}
      and e.status = 'pending'
  `;

  const deleted = await sql<{ id: string }[]>`
    delete from cpd_entries
    where id = ${entryId}
      and practitioner_id = ${identity.user.id}
      and status = 'pending'
      and source = 'self_reported'
    returning id
  `;
  if (deleted.length === 0) return; // not yours / not pending — no-op

  // Best-effort byte cleanup; the nightly orphan sweeper is the backstop.
  for (const a of attachments) {
    try {
      await s3.send(
        new DeleteObjectCommand({ Bucket: a.storage_bucket, Key: a.storage_path })
      );
    } catch {
      // leave it to the sweeper
    }
  }

  revalidatePath("/my-cpd");
  revalidatePath("/dashboard");
  redirect("/my-cpd");
}
