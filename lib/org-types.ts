/**
 * Organization type options (user directive 2026-08-10): NGO + Council
 * added; Polyclinic removed from selection (legacy rows keep their label).
 */
export const ORG_TYPE_OPTIONS = [
  { key: "hospital", label: "Hospital" },
  { key: "clinic", label: "Clinic" },
  { key: "health_centre", label: "Health centre" },
  { key: "ministry", label: "Ministry" },
  { key: "ngo", label: "NGO" },
  { key: "council", label: "Council" },
  { key: "other", label: "Other" },
] as const;

export const ORG_TYPE_LABELS: Record<string, string> = {
  ...Object.fromEntries(ORG_TYPE_OPTIONS.map((t) => [t.key, t.label])),
  polyclinic: "Polyclinic",
};

export const ORG_TYPE_KEYS = ORG_TYPE_OPTIONS.map((t) => t.key as string);
