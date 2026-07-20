import type { Metadata } from "next";
import { format, parseISO } from "date-fns";
import { listUsers } from "@/lib/admin";
import { cn } from "@/lib/utils";
import { RoleDialog } from "@/components/features/admin-users/role-dialog";

export const metadata: Metadata = { title: "Users & roles" };
export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  mma_admin: "Super Admin",
  cpd_committee: "CPD Committee",
  institution_admin: "Institution Admin",
  organizer: "Organizer",
  practitioner: "Practitioner",
};

const STATE_PILL: Record<string, { label: string; className: string }> = {
  verified: {
    label: "Active",
    className:
      "border-status-approved-border bg-status-approved-bg text-status-approved",
  },
  pending: {
    label: "Pending",
    className:
      "border-status-pending-border bg-status-pending-bg text-status-pending",
  },
  rejected: {
    label: "Rejected",
    className:
      "border-status-rejected-border bg-status-rejected-bg text-status-rejected",
  },
};

/**
 * UM1/UM3 — users & roles (Figma 287:12985/12991). v1: list + role
 * management. Invite user + deactivate (UM4) need auth-admin surfaces —
 * deferred with a note (profiles has no is_active flag by design).
 */
export default async function UsersPage() {
  const users = await listUsers();

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-foreground">
          Users &amp; roles
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage accounts, roles and access across the system
        </p>
      </div>

      <div className="flex flex-col rounded-lg border border-border bg-card">
        <div className="flex gap-4 rounded-t-lg bg-muted px-6 py-2.5 text-xs text-muted-foreground">
          <span className="flex-1">User</span>
          <span className="w-44">Roles</span>
          <span className="w-28">Status</span>
          <span className="w-32">Joined</span>
          <span className="w-32" aria-hidden />
        </div>
        {users.map((u) => {
          const pill = STATE_PILL[u.registrationState] ?? STATE_PILL.pending;
          const initials = u.fullName
            .split(/\s+/)
            .map((w) => w[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();
          return (
            <div
              key={u.id}
              className="flex items-center gap-4 border-t border-border px-6 py-3.5"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-primary">
                  {initials}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">
                    {u.fullName}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {u.email}
                  </span>
                </span>
              </div>
              <span className="w-44 text-sm text-foreground">
                {u.roles.length > 0
                  ? u.roles
                      .map((r) => ROLE_LABEL[r] ?? r)
                      .sort()
                      .join(", ")
                  : "—"}
              </span>
              <span className="w-28">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-[9px] py-[3px] text-xs",
                    pill.className
                  )}
                >
                  {pill.label}
                </span>
              </span>
              <span className="w-32 font-mono text-[13px] text-muted-foreground">
                {format(parseISO(u.joinedAt), "dd MMM yyyy")}
              </span>
              <span className="w-32 text-right">
                <RoleDialog
                  userId={u.id}
                  userName={u.fullName}
                  activeRoles={u.roles}
                />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
