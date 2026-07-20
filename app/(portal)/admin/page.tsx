import type { Metadata } from "next";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ChevronRight } from "lucide-react";
import { getOverviewData } from "@/lib/admin";
import { sql } from "@/lib/db";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Operations overview" };
export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  create: "Created",
  update: "Updated",
  delete: "Deleted",
  approve: "Approved",
  reject: "Rejected",
  revoke: "Revoked",
  login: "Signed in",
  export: "Exported",
};

/** OD1 — Operations overview (Figma 287:12777): tiles + attention + activity. */
export default async function AdminOverviewPage() {
  const data = await getOverviewData();
  const [cycle] = await sql<{ name: string; ends_on: Date | string }[]>`
    select name, ends_on from cpd_cycles where is_current limit 1
  `;
  const daysLeft = cycle
    ? Math.max(
        0,
        Math.ceil(
          (new Date(cycle.ends_on).getTime() - Date.now()) / 86_400_000
        )
      )
    : null;

  const tiles = [
    {
      label: "Pending approvals",
      value: data.pendingApprovals + data.pendingEvents,
      detail: `${data.pendingApprovals} practitioners · ${data.pendingEvents} events`,
      detailClass: "text-status-pending",
    },
    {
      label: "Events to review",
      value: data.pendingEvents,
      detail: `${data.pendingEntries} entries also pending`,
      detailClass: "text-status-pending",
    },
    {
      label: "Active practitioners",
      value: data.activePractitioners,
      detail: "registered & verified",
      detailClass: "text-status-approved",
    },
    {
      label: "Certificates issued",
      value: data.certificatesIssued,
      detail: "this cycle",
      detailClass: "text-muted-foreground",
    },
  ];

  const attention: { text: string; sub: string; href: string; tone: string }[] =
    [
      ...(data.pendingApprovals > 0
        ? [
            {
              text: `${data.pendingApprovals} registration approval${data.pendingApprovals === 1 ? "" : "s"} awaiting review`,
              sub: "New practitioner sign-ups",
              href: "/admin/approvals",
              tone: "bg-status-rejected-border",
            },
          ]
        : []),
      ...(data.pendingEvents > 0
        ? [
            {
              text: `${data.pendingEvents} event${data.pendingEvents === 1 ? "" : "s"} pending accreditation`,
              sub: "Waiting on the CPD Committee",
              href: "/committee/events",
              tone: "bg-status-pending-border",
            },
          ]
        : []),
      ...(data.pendingEntries > 0
        ? [
            {
              text: `${data.pendingEntries} CPD entr${data.pendingEntries === 1 ? "y" : "ies"} awaiting review`,
              sub: "Self-reported and event check-ins",
              href: "/committee/entries",
              tone: "bg-status-pending-border",
            },
          ]
        : []),
      ...(cycle
        ? [
            {
              text: `Framework cycle ${cycle.name} active`,
              sub: `Ends ${format(new Date(cycle.ends_on), "d MMM yyyy")} · ${daysLeft} days left`,
              href: "/admin/framework",
              tone: "bg-status-approved-border",
            },
          ]
        : []),
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
            <p className={cn("text-xs", t.detailClass)}>{t.detail}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_1fr] items-start gap-6">
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
          <h2 className="text-base font-semibold text-foreground">
            Needs attention
          </h2>
          {attention.length === 0 ? (
            <p className="text-sm text-muted-foreground">All clear.</p>
          ) : (
            attention.map((a) => (
              <Link
                key={a.text}
                href={a.href}
                className="flex items-center gap-3 rounded-md bg-muted px-4 py-3 hover:bg-accent"
              >
                <span
                  className={cn("h-2 w-2 shrink-0 rounded-full", a.tone)}
                  aria-hidden
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">
                    {a.text}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {a.sub}
                  </span>
                </span>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              </Link>
            ))
          )}
        </div>

        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
          <h2 className="text-base font-semibold text-foreground">
            Recent activity
          </h2>
          {data.recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {data.recentActivity.map((a) => (
                <div key={a.id} className="flex flex-col gap-0.5">
                  <p className="text-sm text-foreground">
                    {a.actorName ?? "System"} ·{" "}
                    {ACTION_LABEL[a.action] ?? a.action}{" "}
                    {a.target ?? a.tableName ?? ""}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {format(parseISO(a.occurredAt), "d MMM · HH:mm")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
