"use client";

import { CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActivityTypeOption } from "@/lib/activities";

/**
 * LA1 — step 1 body: activity-type select (optional shortcut across all
 * leaves) + the four selectable category cards (selected = accent bg,
 * 1.5px primary border, circle-check right).
 */
export function CategoryStep({
  options,
  categoryCode,
  activityTypeId,
  onPickCategory,
  onPickType,
}: {
  options: ActivityTypeOption[];
  categoryCode: string | null;
  activityTypeId: string;
  onPickCategory: (code: string) => void;
  onPickType: (id: string) => void;
}) {
  const chosenType = options.find((o) => o.id === activityTypeId);

  // One card per category, in seed display order.
  const categories = options.reduce<
    { code: string; label: string; shortName: string }[]
  >((acc, o) => {
    if (!acc.some((c) => c.code === o.categoryCode)) {
      acc.push({
        code: o.categoryCode,
        label: o.categoryLabel,
        shortName: o.categoryShortName,
      });
    }
    return acc;
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium leading-[18px] text-foreground">
          Activity type
        </span>
        <Select value={activityTypeId || undefined} onValueChange={onPickType}>
          <SelectTrigger aria-label="Activity type">
            <SelectValue placeholder="Select activity type" />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.categoryLabel} · {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* A chosen activity type already implies its category — show that one
          as information rather than three irrelevant choices (user directive
          2026-07-31). Clearing the type brings the full set back. */}
      {chosenType ? (
        <div
          className="flex w-full items-center gap-3 border-[1.5px] border-primary bg-accent px-3.5 py-3"
          data-testid="implied-category"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">
              {chosenType.categoryLabel}
            </span>
            <span className="text-xs text-muted-foreground">
              {chosenType.categoryShortName}
            </span>
          </span>
          <CircleCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        </div>
      ) : (
        categories.map((c) => {
        const selected = c.code === categoryCode;
        return (
          <button
            key={c.code}
            type="button"
            onClick={() => onPickCategory(c.code)}
            aria-pressed={selected}
            className={cn(
              "flex w-full items-center gap-3 px-3.5 py-3 text-left",
              selected
                ? "border-[1.5px] border-primary bg-accent"
                : "border border-border bg-card"
            )}
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">
                {c.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {c.shortName}
              </span>
            </span>
            {selected && (
              <CircleCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            )}
          </button>
        );
        })
      )}
    </div>
  );
}
