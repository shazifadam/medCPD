import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { AlertTriangle } from "lucide-react";
import { getIdentity } from "@/lib/auth/identity";
import { getMyCpdData } from "@/lib/entries";
import { getActivityTypeOptions } from "@/lib/activities";
import { LogActivityDialog } from "@/components/features/log-activity/log-activity-dialog";
import { EntriesCard } from "@/components/features/entries/entries-card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "My CPD" };
export const dynamic = "force-dynamic";

/**
 * EN1–EN3 — My CPD (Figma 287:12871/12874/12877): cycle progress, category
 * cards, and the full entries ledger with tabs + search. The design frames
 * show three category cards; all four seeded categories render here
 * (deliberate deviation — the matrix has four).
 */
export default async function MyCpdPage() {
  const identity = await getIdentity();
  if (!identity) redirect("/login");

  const [data, activityTypes] = await Promise.all([
    getMyCpdData(identity.user.id),
    getActivityTypeOptions(),
  ]);
  const { dashboard } = data;
  const target = dashboard.cycle?.target ?? 0;
  const pct =
    target > 0 ? Math.min(100, Math.round((dashboard.approved / target) * 100)) : 0;
  const floorPct =
    target > 0 && dashboard.cat1Floor != null
      ? Math.min(100, (dashboard.cat1Floor / target) * 100)
      : null;

  const cycleLine = [
    dashboard.cycle?.name,
    data.cycleEndsOn
      ? `ends ${format(parseISO(data.cycleEndsOn), "d MMM yyyy")}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold text-foreground">My CPD</h1>
          <p className="text-sm text-muted-foreground">{cycleLine}</p>
        </div>
        <LogActivityDialog options={activityTypes} />
      </div>

      {/* Big progress card */}
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-base font-semibold text-foreground">
              Cycle progress to target
            </h2>
            <p className="text-xs text-muted-foreground">
              {dashboard.approved.toFixed(1)} approved ·{" "}
              {dashboard.pending.toFixed(1)} pending · target {target.toFixed(1)}
            </p>
          </div>
          <p className="font-mono text-xl font-medium text-foreground">
            {dashboard.approved.toFixed(1)}{" "}
            <span className="text-muted-foreground">/ {target.toFixed(1)}</span>
          </p>
        </div>
        <div className="relative flex h-7 items-center">
          <div className="h-[7px] w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-success"
              style={{ width: `${pct}%` }}
            />
          </div>
          {floorPct != null && (
            <div
              className="absolute top-0 h-7 w-0.5 bg-foreground"
              style={{ left: `${floorPct}%` }}
              aria-hidden
            />
          )}
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-foreground">
            {dashboard.approved.toFixed(1)} approved
          </span>
          {dashboard.cat1Floor != null && (
            <span className="text-muted-foreground">
              Cat 1 floor ({dashboard.cat1Floor})
            </span>
          )}
          <span className="text-muted-foreground">
            Target {target.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Category cards */}
      <div className="grid grid-cols-4 gap-4">
        {data.categories.map((c) => {
          const catPct =
            c.floor != null && c.floor > 0
              ? Math.min(100, (c.counted / c.floor) * 100)
              : c.counted > 0
                ? 100
                : 0;
          return (
            <div
              key={c.code}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5"
            >
              <div className="flex flex-col gap-0.5">
                <h3 className="text-base font-semibold text-foreground">
                  {c.label}
                </h3>
                <p className="text-xs text-muted-foreground">{c.shortName}</p>
              </div>
              <p className="text-2xl font-semibold text-foreground">
                {c.counted.toFixed(1)}
                {c.floor != null && (
                  <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                    / {c.floor} floor
                  </span>
                )}
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full",
                    c.belowFloor ? "bg-status-pending" : "bg-success"
                  )}
                  style={{ width: `${catPct}%` }}
                />
              </div>
              {c.belowFloor && c.shortBy != null ? (
                <p className="flex items-center gap-1.5 text-xs text-status-pending">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                  Below floor — {c.shortBy} credits short
                </p>
              ) : c.floor != null ? (
                // status-approved, not success — #08c29d fails AA at 12px
                <p className="text-xs text-status-approved">Floor met</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No category floor
                </p>
              )}
            </div>
          );
        })}
      </div>

      <EntriesCard entries={data.entries} options={activityTypes} />
    </div>
  );
}
