/**
 * The five-limit credit engine (Credit Logic doc, vault) — THE one place the
 * math lives. Every screen/report reads from here; never re-implement.
 *
 * Submission time (per entry):  price (Step 2) → Limit #1 per-entry cap.
 * Aggregation time (per cycle): Limit #2 rule cap (per_cycle | per_year)
 *   → Limit #2.5 pooled sub-category (shelf) cap
 *   → Limit #3 category ceiling (none in the MMA matrix — kept, nullable)
 *   → Limit #4 category floors + target ⇒ completion decision.
 * Reconciliation decision: counted totals (doc "Option A") — the headline
 * total applies limits #2/#2.5/#3 before comparing to the target.
 *
 * Pure functions, no DB — unit-tested per Testing Strategy.
 */

export type CalculationMethod =
  | "flat"
  | "per_hour"
  | "per_session"
  | "banded"
  | "manual";

export interface BandStep {
  /** Upper bound in hours; null = open top band. Ascending order. */
  max_hours: number | null;
  points: number;
}

export interface PriceInput {
  method: CalculationMethod;
  rate: number;
  hours?: number | null;
  sessions?: number | null;
  bandLookup?: BandStep[] | null;
  /** Limit #1 — framework_rules.max_per_entry (null = uncapped). */
  maxPerEntry?: number | null;
}

export interface PriceResult {
  credits: number;
  /** Frozen into cpd_entries.calc_inputs at submission. */
  calcInputs: Record<string, unknown>;
}

/** Steps 2 + 3: price one self-reported activity, then clamp (Limit #1). */
export function priceEntry(input: PriceInput): PriceResult {
  const { method, rate } = input;
  let raw: number;

  switch (method) {
    case "flat":
      raw = rate;
      break;
    case "per_hour":
      raw = rate * (input.hours ?? 0);
      break;
    case "per_session":
      raw = rate * (input.sessions ?? 0);
      break;
    case "banded": {
      const hours = input.hours ?? 0;
      const bands = input.bandLookup ?? [];
      // Ascending steps; first band whose max_hours covers the duration.
      const band =
        bands.find((b) => b.max_hours != null && hours <= b.max_hours) ??
        bands.find((b) => b.max_hours == null);
      raw = band?.points ?? 0;
      break;
    }
    case "manual":
      // rate is a SUGGESTION; the reviewer sets the final value at review.
      raw = rate;
      break;
  }

  const cap = input.maxPerEntry ?? null;
  const credits = cap != null ? Math.min(raw, cap) : raw;

  return {
    credits: round2(credits),
    calcInputs: {
      method,
      rate,
      ...(input.hours != null ? { hours: input.hours } : {}),
      ...(input.sessions != null ? { sessions: input.sessions } : {}),
      ...(method === "banded" ? { band_lookup: input.bandLookup } : {}),
      raw_credits: round2(raw),
      ...(cap != null ? { max_per_entry: cap } : {}),
      ...(method === "manual" ? { rule_suggestion: rate } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Step 5 — cycle aggregation
// ---------------------------------------------------------------------------

/** One APPROVED ledger row, as the aggregator needs it. */
export interface ApprovedEntry {
  credits: number;
  categoryCode: string;
  subcategoryCode: string | null;
  frameworkRuleId: string | null;
  /** Calendar year of occurred_on — needed for per_year rule caps. */
  year: number;
}

export interface RuleCap {
  frameworkRuleId: string;
  maxPerCycle: number;
  capPeriod: "per_cycle" | "per_year";
}

export interface CycleFramework {
  target: number;
  /** Limit #2 — only rules that HAVE a max_per_cycle. */
  ruleCaps: RuleCap[];
  /** Limit #2.5 — subcategory code → pooled cap (2D=3, 4A=5, 4B=6). */
  subcategoryCaps: Record<string, number>;
  /** Limits #3/#4 — category code → {floor, ceiling} (null = none). */
  categoryCaps: Record<
    string,
    { min: number | null; max: number | null }
  >;
}

export interface CategoryProgress {
  counted: number;
  floor: number | null;
  belowFloor: boolean;
}

export interface CycleProgress {
  countedTotal: number;
  target: number;
  targetMet: boolean;
  perCategory: Record<string, CategoryProgress>;
  belowFloorCategories: string[];
  complete: boolean;
}

/**
 * Step 5: counted totals + completion. Order is load-bearing:
 * #2 rule caps → #2.5 shelf caps → #3 ceilings → #4 floors + target.
 */
export function aggregateCycle(
  entries: ApprovedEntry[],
  fw: CycleFramework
): CycleProgress {
  // --- Limit #2: cap each rule's contribution (per cycle or per year) ------
  const capped: ApprovedEntry[] = [];
  const ruleCapById = new Map(fw.ruleCaps.map((r) => [r.frameworkRuleId, r]));
  // running contribution per rule (+ per year when per_year)
  const ruleSpend = new Map<string, number>();

  for (const e of entries) {
    const cap = e.frameworkRuleId
      ? ruleCapById.get(e.frameworkRuleId)
      : undefined;
    if (!cap) {
      capped.push(e);
      continue;
    }
    const key =
      cap.capPeriod === "per_year"
        ? `${cap.frameworkRuleId}:${e.year}`
        : cap.frameworkRuleId;
    const spent = ruleSpend.get(key) ?? 0;
    const room = Math.max(0, cap.maxPerCycle - spent);
    const credited = Math.min(e.credits, room);
    ruleSpend.set(key, spent + credited);
    if (credited > 0) capped.push({ ...e, credits: credited });
  }

  // --- Limit #2.5: pooled shelf caps ---------------------------------------
  const bySubcat = new Map<string, number>();
  for (const e of capped) {
    if (e.subcategoryCode == null) continue;
    bySubcat.set(
      e.subcategoryCode,
      (bySubcat.get(e.subcategoryCode) ?? 0) + e.credits
    );
  }
  // shelf overflow to shave, per subcategory
  const shelfOverflow = new Map<string, number>();
  bySubcat.forEach((sum, code) => {
    const cap = fw.subcategoryCaps[code];
    if (cap != null && sum > cap) shelfOverflow.set(code, sum - cap);
  });

  // --- Group by category (after #2, #2.5) ----------------------------------
  const byCategory = new Map<string, number>();
  for (const e of capped) {
    byCategory.set(
      e.categoryCode,
      (byCategory.get(e.categoryCode) ?? 0) + e.credits
    );
  }
  // subtract each shelf's overflow from its parent category total
  shelfOverflow.forEach((overflow, code) => {
    // find the category of this subcategory from any entry carrying it
    const owner = capped.find((e) => e.subcategoryCode === code);
    if (owner) {
      byCategory.set(
        owner.categoryCode,
        round2((byCategory.get(owner.categoryCode) ?? 0) - overflow)
      );
    }
  });

  // --- Limit #3: category ceilings (none in matrix; mechanism kept) --------
  const perCategory: Record<string, CategoryProgress> = {};
  let countedTotal = 0;
  byCategory.forEach((sum, code) => {
    const caps = fw.categoryCaps[code] ?? { min: null, max: null };
    const counted = caps.max != null ? Math.min(sum, caps.max) : sum;
    countedTotal += counted;
    perCategory[code] = {
      counted: round2(counted),
      floor: caps.min,
      belowFloor: caps.min != null && counted < caps.min,
    };
  });
  // categories with a floor but zero entries are still below floor
  for (const [code, caps] of Object.entries(fw.categoryCaps)) {
    if (!(code in perCategory) && caps.min != null && caps.min > 0) {
      perCategory[code] = { counted: 0, floor: caps.min, belowFloor: true };
    }
  }

  // --- Limit #4 + target: the completion decision --------------------------
  const belowFloorCategories = Object.entries(perCategory)
    .filter(([, p]) => p.belowFloor)
    .map(([code]) => code)
    .sort();
  const targetMet = countedTotal >= fw.target;

  return {
    countedTotal: round2(countedTotal),
    target: fw.target,
    targetMet,
    perCategory,
    belowFloorCategories,
    complete: targetMet && belowFloorCategories.length === 0,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
