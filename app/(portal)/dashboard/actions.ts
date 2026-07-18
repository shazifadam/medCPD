"use server";

import { randomUUID, createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { logActivitySchema } from "@/lib/schemas";
import { getIdentity } from "@/lib/auth/identity";
import { sql } from "@/lib/db";
import { priceEntry, type BandStep, type CalculationMethod } from "@/lib/credits";
import { uploadFile, EVIDENCE_BUCKET } from "@/lib/storage";

export type LogActivityState = {
  status: "idle" | "success" | "error";
  error: string | null;
};

const EVIDENCE_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024; // design: "PDF/JPG/PNG up to 10 MB"

/**
 * LA — submit a self-reported CPD entry. Prices via the five-limit engine
 * (Limit #1 at submission), freezes calc_inputs, and applies the LA6
 * pre-registration gate: sub-categories with pre_registration = 'required'
 * are logged for the record with 0.0 credits.
 */
export async function logActivityAction(
  _prev: LogActivityState,
  formData: FormData
): Promise<LogActivityState> {
  const identity = await getIdentity();
  if (!identity) {
    return { status: "error", error: "Your session has expired. Sign in again." };
  }

  const parsed = logActivitySchema.safeParse({
    title: formData.get("title"),
    activityTypeId: formData.get("activityTypeId"),
    occurredOn: formData.get("occurredOn"),
    hoursSessions: formData.get("hoursSessions"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    // Client validation (shared schema) should catch this first (LA5).
    return { status: "error", error: "Please complete the required fields." };
  }
  const input = parsed.data;

  // Evidence file (optional at submission — evidence_requirement 'always'
  // enforcement is a review-time concern per schema Part 5d open questions).
  const file = formData.get("evidence");
  const hasFile = file instanceof File && file.size > 0;
  if (hasFile) {
    if (!EVIDENCE_MIME_TYPES.includes(file.type)) {
      return { status: "error", error: "Evidence must be a PDF, JPG or PNG." };
    }
    if (file.size > EVIDENCE_MAX_BYTES) {
      return { status: "error", error: "Evidence files can be up to 10 MB." };
    }
  }

  // Activity type + its rule for the current cycle + the pre-reg rule.
  const [rule] = await sql<
    {
      activity_type_id: string;
      category_id: string;
      calculation_method: CalculationMethod;
      subcategory_code: string | null;
      pre_registration: "required" | "not_required" | "conditional";
      cycle_id: string;
      rule_id: string | null;
      rate: string | null;
      max_per_entry: string | null;
      band_lookup: BandStep[] | null;
    }[]
  >`
    select
      at.id as activity_type_id,
      at.default_category_id as category_id,
      at.calculation_method,
      sc.code as subcategory_code,
      coalesce(sc.pre_registration, 'not_required') as pre_registration,
      cy.id as cycle_id,
      fr.id as rule_id,
      fr.rate,
      fr.max_per_entry,
      fr.band_lookup
    from activity_types at
    left join credit_subcategories sc on sc.id = at.subcategory_id
    cross join cpd_cycles cy
    left join framework_rules fr
      on fr.activity_type_id = at.id
      and fr.cycle_id = cy.id
      and fr.role_label is null
    where at.id = ${input.activityTypeId}::uuid
      and at.is_active
      and cy.is_current
    limit 1
  `;
  if (!rule) {
    return {
      status: "error",
      error: "This activity type isn't available in the current cycle.",
    };
  }

  // Price the entry (Steps 2 + 3 — Limit #1). The single designed
  // "Hours / sessions" field maps to whichever input the method reads.
  const method = rule.calculation_method;
  const amount = Number(input.hoursSessions);
  const hours = method === "per_hour" || method === "banded" ? amount : null;
  const sessions = method === "per_session" ? Math.round(amount) : null;
  const priced = priceEntry({
    method,
    rate: rule.rate != null ? Number(rule.rate) : 0,
    hours,
    sessions,
    bandLookup: rule.band_lookup,
    maxPerEntry: rule.max_per_entry != null ? Number(rule.max_per_entry) : null,
  });

  // LA6 — pre-registration gate: logged for the record, no credit awarded.
  const preRegGated = rule.pre_registration === "required";
  const credits = preRegGated ? 0 : priced.credits;
  const calcInputs = preRegGated
    ? {
        ...priced.calcInputs,
        pre_registration_gate: true,
        ungated_credits: priced.credits,
      }
    : priced.calcInputs;

  const [entry] = await sql<{ id: string }[]>`
    insert into cpd_entries (
      practitioner_id, source, status,
      cycle_id, category_id, activity_type_id, credits,
      title, description, occurred_on, hours, sessions,
      framework_rule_id, calc_inputs, created_by
    ) values (
      ${identity.user.id}, 'self_reported', 'pending',
      ${rule.cycle_id}, ${rule.category_id}, ${rule.activity_type_id}, ${credits},
      ${input.title}, ${input.description || null}, ${input.occurredOn},
      ${hours}, ${sessions},
      ${rule.rule_id}, ${JSON.stringify(calcInputs)}::jsonb, ${identity.user.id}
    )
    returning id
  `;

  if (hasFile) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const storagePath = `practitioners/${identity.user.id}/${entry.id}/${randomUUID()}-${file.name}`;
    try {
      await uploadFile(EVIDENCE_BUCKET, storagePath, bytes, file.type);
      await sql`
        insert into cpd_entry_attachments (
          entry_id, storage_bucket, storage_path, filename,
          mime_type, size_bytes, checksum_sha256, uploaded_by
        ) values (
          ${entry.id}, ${EVIDENCE_BUCKET}, ${storagePath}, ${file.name},
          ${file.type}, ${file.size},
          ${createHash("sha256").update(bytes).digest("hex")},
          ${identity.user.id}
        )
      `;
    } catch {
      // Entry without its evidence is worse than no entry — roll back.
      await sql`delete from cpd_entries where id = ${entry.id}`;
      return {
        status: "error",
        error: "Couldn't upload your evidence file. Please try again.",
      };
    }
  }

  revalidatePath("/dashboard");
  return { status: "success", error: null };
}
