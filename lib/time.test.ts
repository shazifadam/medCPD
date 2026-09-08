import { describe, expect, it } from "vitest";
import { formatMvt, fromMvtLocal, isTodayMvt, toMvtLocal } from "./time";

describe("Maldives event time (lib/time)", () => {
  it("parses a datetime-local value as MVT (UTC+5) → UTC instant", () => {
    // The 2026-09-08 trial-run bug: "20:00" typed in Malé must be 15:00Z.
    expect(fromMvtLocal("2026-09-08T20:00")).toBe("2026-09-08T15:00:00.000Z");
    expect(fromMvtLocal("2026-01-01T02:30")).toBe("2025-12-31T21:30:00.000Z");
  });

  it("rejects garbage", () => {
    expect(fromMvtLocal("")).toBeNull();
    expect(fromMvtLocal("tonight")).toBeNull();
  });

  it("formats a UTC instant as Maldives wall-clock regardless of runtime zone", () => {
    expect(formatMvt("2026-09-08T15:00:00.000Z", "d MMM yyyy HH:mm")).toBe(
      "8 Sep 2026 20:00"
    );
    // The mis-stored value renders as the next day in MVT — proving the
    // display path is zone-fixed, not runtime-dependent.
    expect(formatMvt("2026-09-08T20:00:00.000Z", "EEEE, d MMM · HH:mm")).toBe(
      "Wednesday, 9 Sep · 01:00"
    );
  });

  it("round-trips through the edit-form value", () => {
    const iso = fromMvtLocal("2026-12-31T21:00")!;
    expect(toMvtLocal(iso)).toBe("2026-12-31T21:00");
  });

  it("isTodayMvt compares calendar days in MVT", () => {
    expect(isTodayMvt(new Date())).toBe(true);
    expect(isTodayMvt(new Date(Date.now() + 3 * 86_400_000))).toBe(false);
  });
});
