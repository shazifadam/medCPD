import type { Metadata } from "next";
import Link from "next/link";
import {
  listPractitionerScores,
  listSpecialtyOptions,
  type ScoreFilter,
} from "@/lib/practitioner-scores";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Practitioner scores" };
export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  "on-track": "bg-status-approved-bg text-status-approved",
  "below-floor": "bg-status-pending-bg text-status-pending",
  complete: "bg-secondary text-foreground",
};
const STATUS_LABELS: Record<string, string> = {
  "on-track": "On track",
  "below-floor": "Below floor",
  complete: "Complete",
};

/** U1-PS1 — practitioner scores list: search + specialty + score filters. */
export default async function PractitionerScoresPage({
  searchParams,
}: {
  searchParams: { q?: string; specialty?: string; score?: string };
}) {
  const score = (searchParams.score ?? "all") as ScoreFilter;
  const [{ rows, cycleName }, specialties] = await Promise.all([
    listPractitionerScores({
      q: searchParams.q,
      specialtyId: searchParams.specialty || undefined,
      score,
    }),
    listSpecialtyOptions(),
  ]);

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-foreground">
          Practitioner scores
        </h1>
        <p className="text-sm text-muted-foreground">
          Cycle progress and eligibility for every practitioner
          {cycleName ? ` — ${cycleName}` : ""}
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          name="q"
          defaultValue={searchParams.q ?? ""}
          placeholder="Search by name or PMR / TMR number…"
          className="w-80"
          aria-label="Search practitioners"
        />
        <select
          name="specialty"
          defaultValue={searchParams.specialty ?? ""}
          aria-label="Filter by specialty"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
        >
          <option value="">All specialties</option>
          {specialties.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          name="score"
          defaultValue={score}
          aria-label="Filter by score"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
        >
          <option value="all">All scores</option>
          <option value="below-floor">Below floor</option>
          <option value="on-track">On track</option>
          <option value="complete">Complete</option>
        </select>
        <Button type="submit" variant="outline" size="sm">
          Apply
        </Button>
      </form>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Practitioner</th>
              <th className="px-4 py-3 font-medium">Registration</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Total / target</th>
              <th className="px-4 py-3 font-medium" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  No practitioners match these filters.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{r.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {[
                        r.specialty,
                        `${r.earned.toFixed(1)} earned`,
                        r.pending > 0 ? `${r.pending.toFixed(1)} pending` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {r.registration ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        STATUS_STYLES[r.status]
                      )}
                    >
                      {STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {r.earned.toFixed(1)} / {r.target.toFixed(0)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/practitioner-scores/${r.id}`}>View</Link>
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
