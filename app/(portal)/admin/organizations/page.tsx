import type { Metadata } from "next";
import { listOrganizations } from "@/lib/admin";
import { cn } from "@/lib/utils";
import { CreateOrgDialog } from "@/components/features/admin-users/create-org-dialog";

export const metadata: Metadata = { title: "Organizations" };
export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  hospital: "Hospital",
  clinic: "Clinic",
  polyclinic: "Polyclinic",
  health_centre: "Health centre",
  ministry: "Ministry",
  other: "Other",
};

/**
 * OG1/OG2 — organizations list + register (Figma 287:12848/12851).
 * OG3 per-org detail arrives with organizer memberships (noted deviation).
 */
export default async function OrganizationsPage() {
  const orgs = await listOrganizations();

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold text-foreground">
            Organizations
          </h1>
          <p className="text-sm text-muted-foreground">
            Hosts and training providers who run accredited events
          </p>
        </div>
        <CreateOrgDialog />
      </div>

      <div className="flex flex-col rounded-lg border border-border bg-card">
        <div className="flex gap-4 rounded-t-lg bg-muted px-6 py-2.5 text-xs text-muted-foreground">
          <span className="flex-1">Organization</span>
          <span className="w-36">Type</span>
          <span className="w-28">Events</span>
          <span className="w-32">Status</span>
        </div>
        {orgs.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">
            No organizations registered yet.
          </p>
        ) : (
          orgs.map((o) => (
            <div
              key={o.id}
              className="flex items-center gap-4 border-t border-border px-6 py-3.5"
            >
              <span className="flex-1 truncate text-sm font-medium text-foreground">
                {o.name}
              </span>
              <span className="w-36 text-sm text-muted-foreground">
                {TYPE_LABEL[o.type] ?? o.type}
              </span>
              <span className="w-28 font-mono text-[13px] text-foreground">
                {o.eventCount}
              </span>
              <span className="w-32">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-[9px] py-[3px] text-xs",
                    o.isVerified
                      ? "border-status-approved-border bg-status-approved-bg text-status-approved"
                      : "border-status-pending-border bg-status-pending-bg text-status-pending"
                  )}
                >
                  {o.isVerified ? "Accredited provider" : "Unverified"}
                </span>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
