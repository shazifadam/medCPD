import type { DashboardData } from "@/lib/dashboard";

/** Credit progress card: approved bar, Cat-1 floor tick, % badge. */
export function CreditProgress({ data }: { data: DashboardData }) {
  const target = data.cycle?.target ?? 0;
  const pct =
    target > 0 ? Math.min(100, Math.round((data.approved / target) * 100)) : 0;
  const floorPct =
    target > 0 && data.cat1Floor != null
      ? Math.min(100, (data.cat1Floor / target) * 100)
      : null;

  const subtitle =
    data.pending > 0
      ? `${data.approved.toFixed(1)} approved · ${data.pending.toFixed(1)} pending · target ${target.toFixed(1)}`
      : `${data.approved.toFixed(1)} approved · target ${target.toFixed(1)}`;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-semibold text-foreground">
            Credit progress
          </h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <p className="font-mono text-2xl font-semibold text-foreground">
          {pct}%
        </p>
      </div>

      <div className="relative h-2 w-full rounded-full bg-secondary">
        <div
          className="h-2 rounded-full bg-status-approved"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Approved credit progress"
        />
        {floorPct != null && (
          <div
            className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-foreground"
            style={{ left: `${floorPct}%` }}
            aria-hidden
          />
        )}
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">
          {data.approved.toFixed(1)} approved
        </span>
        {data.cat1Floor != null && (
          <span className="text-muted-foreground">
            Cat 1 floor ({data.cat1Floor})
          </span>
        )}
        <span className="text-muted-foreground">
          Target {target.toFixed(1)}
        </span>
      </div>
    </div>
  );
}
