import { Info, TriangleAlert, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Dashboard state callout (DB2/DB3/DB4). DB1 (on-track) shows none.
 */
export function DashboardCallout({
  state,
}: {
  state: "empty" | "on-track" | "below-floor" | "complete";
}) {
  if (state === "on-track") return null;

  if (state === "empty") {
    return (
      <div className="flex gap-3 rounded-lg border border-primary/30 bg-accent px-4 py-3 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="font-medium text-primary">
            Welcome to Gradus — start logging your CPD
          </p>
          {/* Full primary (no /80) — 80% opacity fails WCAG contrast on
              the accent bg (axe: 4.04 < 4.5). */}
          <p className="text-primary">
            Log an activity or browse accredited events to begin earning
            credits.
          </p>
        </div>
      </div>
    );
  }

  if (state === "below-floor") {
    return (
      <div className="flex gap-3 rounded-lg border border-status-pending-border bg-status-pending-bg px-4 py-3 text-sm">
        <TriangleAlert
          className="mt-0.5 h-4 w-4 shrink-0 text-status-pending"
          aria-hidden
        />
        <div className="flex flex-col gap-1 text-status-pending">
          <p className="font-medium">Category 1 below floor</p>
          <p>
            You&apos;ve met the overall target, but Category 1 is below its
            floor. The cycle is not complete until every category floor is
            satisfied.
          </p>
        </div>
      </div>
    );
  }

  // complete
  return (
    <div className="flex items-center gap-3 rounded-lg border border-status-approved-border bg-status-approved-bg px-4 py-3 text-sm">
      <CircleCheck
        className="h-4 w-4 shrink-0 text-status-approved"
        aria-hidden
      />
      <div className="flex flex-1 flex-col gap-1 text-status-approved">
        <p className="font-medium">Cycle complete — certificate ready</p>
        <p>
          You&apos;ve met your target and all category floors. Download your
          completion certificate.
        </p>
      </div>
      {/* Certificate download lands in P7 */}
      <Button size="sm">Download certificate</Button>
    </div>
  );
}
