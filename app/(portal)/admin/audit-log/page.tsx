import type { Metadata } from "next";
import { format, parseISO } from "date-fns";
import { getAuditLog } from "@/lib/admin";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

const ACTION_PILL: Record<string, { label: string; className: string }> = {
  create: {
    label: "Created",
    className:
      "border-status-approved-border bg-status-approved-bg text-status-approved",
  },
  update: {
    label: "Updated",
    className:
      "border-status-under-review-border bg-status-under-review-bg text-status-under-review",
  },
  delete: {
    label: "Deleted",
    className:
      "border-status-rejected-border bg-status-rejected-bg text-status-rejected",
  },
  approve: {
    label: "Approved",
    className:
      "border-status-approved-border bg-status-approved-bg text-status-approved",
  },
  reject: {
    label: "Rejected",
    className:
      "border-status-rejected-border bg-status-rejected-bg text-status-rejected",
  },
  revoke: {
    label: "Revoked",
    className:
      "border-status-rejected-border bg-status-rejected-bg text-status-rejected",
  },
  login: { label: "Signed in", className: "border-border bg-muted text-muted-foreground" },
  export: { label: "Exported", className: "border-border bg-muted text-muted-foreground" },
};

const ROLE_LABEL: Record<string, string> = {
  mma_admin: "Super Admin",
  cpd_committee: "CPD Committee",
  institution_admin: "Institution Admin",
  organizer: "Organizer",
  practitioner: "Practitioner",
};

/**
 * AL1 — audit log (Figma 287:13031). v1 shows the newest 100 rows; the
 * designed search/date/actor filters + export + AL2 row detail arrive with
 * the reporting pass (noted deviation).
 */
export default async function AuditLogPage() {
  const rows = await getAuditLog(100);

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-foreground">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          Immutable record of every action across the system
        </p>
      </div>

      <div className="flex flex-col rounded-lg border border-border bg-card">
        <div className="flex gap-4 rounded-t-lg bg-muted px-6 py-2.5 text-xs text-muted-foreground">
          <span className="w-32">Time</span>
          <span className="w-52">Actor</span>
          <span className="w-32">Action</span>
          <span className="flex-1">Target</span>
        </div>
        {rows.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">
            No audit entries yet.
          </p>
        ) : (
          rows.map((r) => {
            const pill = ACTION_PILL[r.action] ?? ACTION_PILL.update;
            return (
              <div
                key={r.id}
                className="flex items-center gap-4 border-t border-border px-6 py-3"
              >
                <span className="w-32 font-mono text-[13px] text-muted-foreground">
                  {format(parseISO(r.occurredAt), "d MMM · HH:mm")}
                </span>
                <span className="flex w-52 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">
                    {r.actorName ?? "System"}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {r.actorRole ? (ROLE_LABEL[r.actorRole] ?? r.actorRole) : "—"}
                  </span>
                </span>
                <span className="w-32">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-[9px] py-[3px] text-xs",
                      pill.className
                    )}
                  >
                    {pill.label}
                  </span>
                </span>
                <span className="flex-1 truncate text-sm text-foreground">
                  {r.target ?? r.tableName ?? "—"}
                  {r.tableName && r.target !== r.tableName ? (
                    <span className="text-muted-foreground">
                      {" "}
                      · {r.tableName}
                    </span>
                  ) : null}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
