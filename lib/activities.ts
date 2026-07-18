import "server-only";
import { sql } from "@/lib/db";

/**
 * Activity-type options for the LA dialog. One row per active activity leaf
 * (17 in the seeded matrix), carrying everything the client needs to render
 * step 1 (category cards) and step 2 (type select + LA6 pre-reg gate).
 * Pricing data (rule rate/bands) stays server-side in the submit action.
 */

export interface ActivityTypeOption {
  id: string;
  name: string;
  categoryCode: string; // 'CAT1' …
  categoryLabel: string; // 'Cat 1'
  categoryShortName: string; // 'Formal learning' — card subtitle per LA1
  subcategoryCode: string | null; // '1A' …
  preRegistration: "required" | "not_required" | "conditional";
  calculationMethod: "flat" | "per_hour" | "per_session" | "banded" | "manual";
}

/** LA1 card subtitles (design copy — shorter than the DB category names). */
const CATEGORY_SHORT_NAMES: Record<string, string> = {
  CAT1: "Formal learning",
  CAT2: "Practice-based",
  CAT3: "Academic & scholarly",
  CAT4: "Leadership",
};

export async function getActivityTypeOptions(): Promise<ActivityTypeOption[]> {
  const rows = await sql<
    {
      id: string;
      name: string;
      category_code: string;
      subcategory_code: string | null;
      pre_registration: ActivityTypeOption["preRegistration"];
      calculation_method: ActivityTypeOption["calculationMethod"];
      display_order: number;
    }[]
  >`
    select
      at.id,
      at.name,
      cc.code as category_code,
      sc.code as subcategory_code,
      coalesce(sc.pre_registration, 'not_required') as pre_registration,
      at.calculation_method,
      sc.display_order
    from activity_types at
    join credit_categories cc on cc.id = at.default_category_id
    left join credit_subcategories sc on sc.id = at.subcategory_id
    where at.is_active
    order by cc.display_order, sc.display_order, at.name
  `;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    categoryCode: r.category_code,
    categoryLabel: `Cat ${r.category_code.replace("CAT", "")}`,
    categoryShortName: CATEGORY_SHORT_NAMES[r.category_code] ?? r.category_code,
    subcategoryCode: r.subcategory_code,
    preRegistration: r.pre_registration,
    calculationMethod: r.calculation_method,
  }));
}
