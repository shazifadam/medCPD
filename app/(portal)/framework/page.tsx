import type { Metadata } from "next";
import Link from "next/link";
import { listCycles } from "@/lib/framework-admin";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Framework" };
export const dynamic = "force-dynamic";

/** FM2 — cycles list. Entry point for F3 (draft rate book) and F6 (active). */
export default async function FrameworkCyclesPage() {
  const cycles = await listCycles();

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-foreground">Framework</h1>
        <p className="text-sm text-muted-foreground">
          Cycles, rate books and certification thresholds
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Cycle</th>
              <th className="px-4 py-3 font-medium">Dates</th>
              <th className="px-4 py-3 font-medium">Rate book</th>
              <th className="px-4 py-3 font-medium">Entries</th>
              <th className="px-4 py-3 font-medium" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {cycles.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-b-0">
                <td className="px-4 py-3 font-medium text-foreground">
                  {c.name}
                  {c.isCurrent && (
                    <span className="ml-2 rounded-full bg-status-approved-bg px-2 py-0.5 text-xs font-medium text-status-approved">
                      Active
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {c.startsOn} → {c.endsOn}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      c.rateBookStatus === "draft"
                        ? "bg-status-pending-bg text-status-pending"
                        : "bg-secondary text-foreground"
                    )}
                  >
                    {c.rateBookStatus === "draft" ? "Draft" : "Approved"}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {c.entryCount}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/framework/${c.id}`}>Rate book</Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/framework/${c.id}/thresholds`}>Thresholds</Link>
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
