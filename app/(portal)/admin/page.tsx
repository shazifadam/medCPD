import type { Metadata } from "next";
import { sql } from "@/lib/db";

export const metadata: Metadata = { title: "Operations overview" };
export const dynamic = "force-dynamic";

/**
 * OD1 — Operations overview (Figma 394:1330), first pass: header + the four
 * stat tiles. Practitioner counts are live; events/certificates read 0 until
 * their tables land (P4/P7). Needs-attention + recent-activity panels follow
 * with the audit-log chunk.
 */
export default async function AdminOverviewPage() {
  const [counts] = await sql<
    { pending_practitioners: number; active_practitioners: number }[]
  >`
    select
      count(*) filter (where registration_state = 'pending')::int
        as pending_practitioners,
      count(*) filter (where registration_state = 'verified')::int
        as active_practitioners
    from profiles
  `;

  const tiles = [
    {
      label: "Pending approvals",
      value: counts.pending_practitioners,
      detail: `${counts.pending_practitioners} practitioners · 0 events`,
      detailClass: "text-status-pending",
    },
    {
      label: "Events to review",
      value: 0, // events tables land in P4
      detail: "0 overdue",
      detailClass: "text-status-pending",
    },
    {
      label: "Active practitioners",
      value: counts.active_practitioners,
      detail: "registered & verified",
      detailClass: "text-status-approved",
    },
    {
      label: "Certificates issued",
      value: 0, // certificates land in P7
      detail: "this cycle",
      detailClass: "text-muted-foreground",
    },
  ];

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-foreground">
          Operations overview
        </h1>
        <p className="text-sm text-muted-foreground">
          System health and items needing your attention
        </p>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="flex flex-col gap-2 rounded-lg border border-border bg-card p-5"
          >
            <p className="text-sm text-muted-foreground">{t.label}</p>
            <p className="font-mono text-3xl font-semibold text-foreground">
              {t.value.toLocaleString()}
            </p>
            <p className={`text-xs ${t.detailClass}`}>{t.detail}</p>
          </div>
        ))}
      </div>

      {/* Needs attention + Recent activity panels arrive with the
          audit-log/approvals chunk. */}
    </div>
  );
}
