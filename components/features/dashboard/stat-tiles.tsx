import type { DashboardData } from "@/lib/dashboard";

/** The three DB stat tiles: credits this cycle · Cat 1 floor · pending review. */
export function StatTiles({ data }: { data: DashboardData }) {
  const creditsHint =
    data.state === "empty"
      ? { text: "Not started", cls: "text-muted-foreground" }
      : data.approved >= (data.cycle?.target ?? Infinity)
        ? { text: "▲ Target met", cls: "text-status-approved" }
        : { text: "▲ On track", cls: "text-status-approved" };

  const floorHint =
    data.state === "empty"
      ? { text: "Not started", cls: "text-muted-foreground" }
      : data.cat1Floor != null && data.cat1Approved < data.cat1Floor
        ? { text: "Below floor", cls: "text-status-pending" }
        : { text: "Floor met", cls: "text-status-approved" };

  return (
    <div className="grid grid-cols-3 gap-6">
      <Tile
        label="CREDITS THIS CYCLE"
        value={data.approved.toFixed(1)}
        denom={data.cycle ? `/ ${data.cycle.target}` : undefined}
        hint={creditsHint.text}
        hintClass={creditsHint.cls}
      />
      <Tile
        label="CATEGORY 1 FLOOR"
        value={data.cat1Approved.toFixed(1)}
        denom={data.cat1Floor != null ? `/ ${data.cat1Floor}` : undefined}
        hint={floorHint.text}
        hintClass={floorHint.cls}
      />
      <Tile
        label="PENDING REVIEW"
        value={String(data.pendingCount)}
        hint="entries awaiting"
        hintClass="text-muted-foreground"
      />
    </div>
  );
}

function Tile({
  label,
  value,
  denom,
  hint,
  hintClass,
}: {
  label: string;
  value: string;
  denom?: string;
  hint: string;
  hintClass: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="font-mono text-3xl font-semibold text-foreground">
        {value}
        {denom && (
          <span className="ml-1 text-base font-normal text-muted-foreground">
            {denom}
          </span>
        )}
      </p>
      <p className={`text-xs ${hintClass}`}>{hint}</p>
    </div>
  );
}
