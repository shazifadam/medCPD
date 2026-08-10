import type { Metadata } from "next";
import Link from "next/link";
import { listOrganizations } from "@/lib/admin";
import { cn } from "@/lib/utils";
import { ORG_TYPE_LABELS } from "@/lib/org-types";
import { CreateOrgDialog } from "@/components/features/admin-users/create-org-dialog";
import { VerifyOrgButton } from "@/components/features/organizations/verify-button";
import { OrgRowActions } from "@/components/features/organizations/org-row-actions";

export const metadata: Metadata = { title: "Organizations" };
export const dynamic = "force-dynamic";

/**
 * OG1/OG2 — organizations list + register + verify. Shared by admins and
 * committee members (layout guard); unverified rows carry a Verify action.
 */
export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: { show?: string };
}) {
  const showArchived = searchParams.show === "archived";
  const orgs = await listOrganizations(showArchived);

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
        <div className="flex items-center gap-2">
          <Link
            href={showArchived ? "/organizations" : "/organizations?show=archived"}
            className="text-sm font-medium text-primary hover:underline"
          >
            {showArchived ? "← Active organizations" : "View archived"}
          </Link>
          {!showArchived && <CreateOrgDialog />}
        </div>
      </div>

      <div className="flex flex-col rounded-lg border border-border bg-card">
        <div className="flex gap-4 rounded-t-lg bg-muted px-6 py-2.5 text-xs text-muted-foreground">
          <span className="flex-1">Organization</span>
          <span className="w-32">Type</span>
          <span className="w-20">Events</span>
          <span className="w-40">Status</span>
          <span className="w-56" aria-hidden />
        </div>
        {orgs.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">
            {showArchived
              ? "No archived organizations."
              : "No organizations registered yet."}
          </p>
        ) : (
          orgs.map((o) => (
            <div
              key={o.id}
              className="flex items-center gap-4 border-t border-border px-6 py-3"
            >
              <span className="flex-1 truncate text-sm font-medium text-foreground">
                {o.name}
              </span>
              <span className="w-32 text-sm text-muted-foreground">
                {ORG_TYPE_LABELS[o.type] ?? o.type}
              </span>
              <span className="w-20 font-mono text-[13px] text-foreground">
                {o.eventCount}
              </span>
              <span className="w-40">
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
              <span className="flex w-56 justify-end gap-2">
                {!showArchived && !o.isVerified && (
                  <VerifyOrgButton institutionId={o.id} name={o.name} />
                )}
                <OrgRowActions
                  org={{
                    id: o.id,
                    name: o.name,
                    type: o.type,
                    isActive: !showArchived,
                  }}
                />
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
