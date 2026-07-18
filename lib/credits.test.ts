import { describe, it, expect } from "vitest";
import {
  priceEntry,
  aggregateCycle,
  type ApprovedEntry,
  type CycleFramework,
} from "./credits";

/**
 * Credit engine tests — the limit interactions from the Credit Logic doc,
 * including the worked example (Dr. A) end to end.
 */

const CAT1_BANDS = [
  { max_hours: 4, points: 4 },
  { max_hours: 8, points: 8 },
  { max_hours: 16, points: 16 },
  { max_hours: null, points: 20 },
];

describe("priceEntry — Steps 2+3", () => {
  it("flat ignores hours", () => {
    expect(
      priceEntry({ method: "flat", rate: 3, hours: 99 }).credits
    ).toBe(3);
  });

  it("per_hour multiplies", () => {
    expect(
      priceEntry({ method: "per_hour", rate: 0.5, hours: 4 }).credits
    ).toBe(2);
  });

  it("per_session multiplies", () => {
    expect(
      priceEntry({ method: "per_session", rate: 1, sessions: 3 }).credits
    ).toBe(3);
  });

  it("banded: 6-hour full day earns 8, not 6 (stepped, not linear)", () => {
    expect(
      priceEntry({ method: "banded", rate: 0, hours: 6, bandLookup: CAT1_BANDS })
        .credits
    ).toBe(8);
  });

  it("banded: boundary lands in the lower band (4h → 4)", () => {
    expect(
      priceEntry({ method: "banded", rate: 0, hours: 4, bandLookup: CAT1_BANDS })
        .credits
    ).toBe(4);
  });

  it("banded: over the top step hits the open band (20h → 20)", () => {
    expect(
      priceEntry({ method: "banded", rate: 0, hours: 20, bandLookup: CAT1_BANDS })
        .credits
    ).toBe(20);
  });

  it("Limit #1 clamps: 12h conference at 1/hr capped to 8", () => {
    const r = priceEntry({
      method: "per_hour",
      rate: 1,
      hours: 12,
      maxPerEntry: 8,
    });
    expect(r.credits).toBe(8);
    expect(r.calcInputs.raw_credits).toBe(12);
    expect(r.calcInputs.max_per_entry).toBe(8);
  });

  it("manual records the rate as a suggestion", () => {
    const r = priceEntry({ method: "manual", rate: 4 });
    expect(r.credits).toBe(4);
    expect(r.calcInputs.rule_suggestion).toBe(4);
  });
});

// ---------------------------------------------------------------------------

const MATRIX: CycleFramework = {
  target: 30, // illustrative — C1 open, mirrors the doc's worked example
  ruleCaps: [],
  subcategoryCaps: { "2D": 3, "4A": 5, "4B": 6 },
  categoryCaps: {
    CAT1: { min: 5, max: null },
    CAT2: { min: 5, max: null },
    CAT3: { min: null, max: null },
    CAT4: { min: null, max: null },
  },
};

function e(
  credits: number,
  categoryCode: string,
  subcategoryCode: string | null,
  extra: Partial<ApprovedEntry> = {}
): ApprovedEntry {
  return {
    credits,
    categoryCode,
    subcategoryCode,
    frameworkRuleId: null,
    year: 2026,
    ...extra,
  };
}

describe("aggregateCycle — the doc's worked example (Dr. A)", () => {
  const entries = [
    e(16, "CAT1", "1A"), // 2-day conference, attendee
    e(5, "CAT3", "3A"), // same conference, keynote
    e(2, "CAT2", "2D"), // CPR committee
    e(2, "CAT2", "2D"), // transplant committee → shelf 2D = 4, capped to 3
    e(3, "CAT4", "4B"), // outreach Gaafu
    e(3, "CAT4", "4B"), // camp Addu → shelf 4B = 6, at cap
  ];

  it("counts 30 (2D shaves 1) but stays incomplete — CAT2 below floor", () => {
    const p = aggregateCycle(entries, MATRIX);
    expect(p.countedTotal).toBe(30);
    expect(p.targetMet).toBe(true);
    expect(p.perCategory.CAT1.counted).toBe(16);
    expect(p.perCategory.CAT2.counted).toBe(3); // 4 − 1 shelf overflow
    expect(p.perCategory.CAT3.counted).toBe(5);
    expect(p.perCategory.CAT4.counted).toBe(6);
    expect(p.belowFloorCategories).toEqual(["CAT2"]);
    expect(p.complete).toBe(false); // the classic trap: 100% yet not done
  });
});

describe("aggregateCycle — limit order and edges", () => {
  it("Limit #2 per_cycle rule cap pools across entries of one rule", () => {
    const fw: CycleFramework = {
      ...MATRIX,
      ruleCaps: [
        { frameworkRuleId: "r1", maxPerCycle: 10, capPeriod: "per_cycle" },
      ],
    };
    const p = aggregateCycle(
      [
        e(6, "CAT2", "2C", { frameworkRuleId: "r1" }),
        e(6, "CAT2", "2C", { frameworkRuleId: "r1" }), // only 4 fit
      ],
      fw
    );
    expect(p.perCategory.CAT2.counted).toBe(10);
  });

  it("Limit #2 per_year resets per calendar year (3D = 5/year)", () => {
    const fw: CycleFramework = {
      ...MATRIX,
      ruleCaps: [
        { frameworkRuleId: "r3d", maxPerCycle: 5, capPeriod: "per_year" },
      ],
    };
    const p = aggregateCycle(
      [
        e(5, "CAT3", "3D", { frameworkRuleId: "r3d", year: 2026 }),
        e(5, "CAT3", "3D", { frameworkRuleId: "r3d", year: 2026 }), // capped out
        e(5, "CAT3", "3D", { frameworkRuleId: "r3d", year: 2027 }), // new window
      ],
      fw
    );
    expect(p.perCategory.CAT3.counted).toBe(10); // 5 + 0 + 5
  });

  it("Limit #2 applies BEFORE #2.5 (rule-capped credits feed the shelf)", () => {
    const fw: CycleFramework = {
      ...MATRIX,
      ruleCaps: [
        { frameworkRuleId: "r1", maxPerCycle: 4, capPeriod: "per_cycle" },
      ],
    };
    const p = aggregateCycle(
      [e(10, "CAT2", "2D", { frameworkRuleId: "r1" })], // rule → 4, shelf → 3
      fw
    );
    expect(p.perCategory.CAT2.counted).toBe(3);
  });

  it("Limit #3 category ceiling clamps when configured", () => {
    const fw: CycleFramework = {
      ...MATRIX,
      categoryCaps: { ...MATRIX.categoryCaps, CAT3: { min: null, max: 10 } },
    };
    const p = aggregateCycle([e(8, "CAT3", "3A"), e(8, "CAT3", "3B")], fw);
    expect(p.perCategory.CAT3.counted).toBe(10);
  });

  it("a floor category with zero entries is below floor", () => {
    const p = aggregateCycle([e(30, "CAT3", "3A")], MATRIX);
    expect(p.belowFloorCategories).toEqual(["CAT1", "CAT2"]);
    expect(p.complete).toBe(false);
  });

  it("complete when target met and all floors met", () => {
    const p = aggregateCycle(
      [e(16, "CAT1", "1A"), e(5, "CAT2", "2A2"), e(9, "CAT3", "3A")],
      MATRIX
    );
    expect(p.countedTotal).toBe(30);
    expect(p.complete).toBe(true);
  });

  it("empty ledger: incomplete, floors reported", () => {
    const p = aggregateCycle([], MATRIX);
    expect(p.countedTotal).toBe(0);
    expect(p.belowFloorCategories).toEqual(["CAT1", "CAT2"]);
    expect(p.complete).toBe(false);
  });
});
