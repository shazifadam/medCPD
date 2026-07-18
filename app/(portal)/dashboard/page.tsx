import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, ArrowRight } from "lucide-react";
import { sql } from "@/lib/db";
import { getIdentity } from "@/lib/auth/identity";
import { getDashboardData } from "@/lib/dashboard";
import { getActivityTypeOptions } from "@/lib/activities";
import { getRecentEntries } from "@/lib/entries";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { LogActivityDialog } from "@/components/features/log-activity/log-activity-dialog";
import { StatusBadge } from "@/components/features/entries/status-badge";
import { DashboardCallout } from "@/components/features/dashboard/callout";
import { StatTiles } from "@/components/features/dashboard/stat-tiles";
import { CreditProgress } from "@/components/features/dashboard/credit-progress";

export const metadata: Metadata = { title: "My CPD dashboard" };
export const dynamic = "force-dynamic";

/**
 * DB1–DB4 — My CPD dashboard (Figma 287:12781/12784/12787/12790).
 * All values data-driven; with no entries yet (P3) every practitioner sees
 * the DB4 empty state. Entries table + events panel populate in P3/P4.
 */
export default async function DashboardPage() {
  const identity = await getIdentity();
  if (!identity) redirect("/login");

  const [profile] = await sql<
    { full_name: string; mmdc_registration: string | null; specialty: string | null }[]
  >`
    select p.full_name, p.mmdc_registration, s.name as specialty
    from profiles p
    left join practitioner_specialties ps
      on ps.practitioner_id = p.id and ps.is_primary
    left join specialties s on s.id = ps.specialty_id
    where p.id = ${identity.user.id}
  `;
  const [data, activityTypes, recent] = await Promise.all([
    getDashboardData(identity.user.id),
    getActivityTypeOptions(),
    getRecentEntries(identity.user.id),
  ]);

  const identityLine = [
    profile?.full_name,
    profile?.mmdc_registration,
    profile?.specialty,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      {/* Header row: title + cycle + actions */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold text-foreground">
            My CPD dashboard
          </h1>
          <p className="text-sm text-muted-foreground">{identityLine}</p>
        </div>
        <div className="flex items-center gap-3">
          {data.cycle && (
            <div className="flex h-10 items-center rounded-md border border-input bg-card px-4 text-sm text-foreground">
              {data.cycle.name}
            </div>
          )}
          <LogActivityDialog options={activityTypes} />
          <Button asChild variant="outline">
            <Link href="/events">
              <Search className="mr-1.5 h-4 w-4" aria-hidden />
              Browse events
            </Link>
          </Button>
        </div>
      </div>

      <DashboardCallout state={data.state} />
      <StatTiles data={data} />
      <CreditProgress data={data} />

      {/* Bottom panels: recent entries + upcoming events */}
      <div className="grid grid-cols-[1fr_360px] gap-6">
        <div className="flex flex-col rounded-lg border border-border bg-card">
          <div className="flex items-start justify-between p-5 pb-4">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-base font-semibold text-foreground">
                Recent CPD entries
              </h2>
              <p className="text-xs text-muted-foreground">
                {data.state === "empty" ? "No entries yet" : "Last 4 activities"}
              </p>
            </div>
            <Link
              href="/my-cpd"
              className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              View all <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="flex flex-1 items-center justify-center p-10">
              <p className="text-sm text-muted-foreground">
                No CPD entries yet
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
              <div className="flex gap-3 border-y border-border bg-muted px-5 py-2.5 text-[11px] tracking-[0.5px] text-muted-foreground">
                <span className="flex-1">ACTIVITY</span>
                <span className="w-32">CATEGORY</span>
                <span className="w-20">DATE</span>
                <span className="w-14 text-right">CREDITS</span>
                <span className="w-24">STATUS</span>
              </div>
              {recent.map((e) => (
                <Link
                  key={e.id}
                  href={`/my-cpd/${e.id}`}
                  className="flex items-center gap-3 border-b border-border px-5 py-3 last:border-0 hover:bg-muted/50"
                >
                  <span className="flex-1 truncate text-sm text-foreground">
                    {e.title}
                  </span>
                  <span className="w-32 truncate text-sm text-muted-foreground">
                    {e.categoryLabel}
                  </span>
                  <span className="w-20 font-mono text-[13px] text-muted-foreground">
                    {format(parseISO(e.occurredOn), "dd MMM yy")}
                  </span>
                  <span className="w-14 text-right font-mono text-[13px] font-medium text-foreground">
                    {e.credits.toFixed(1)}
                  </span>
                  <span className="w-24">
                    <StatusBadge status={e.status} />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col rounded-lg border border-border bg-card">
          <div className="flex items-start justify-between p-5 pb-4">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-base font-semibold text-foreground">
                Upcoming events
              </h2>
              <p className="text-xs text-muted-foreground">
                Accredited activities you may attend
              </p>
            </div>
            <Link
              href="/events"
              className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Browse <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          {/* Registered/upcoming events land in P4 */}
          <div className="flex flex-1 items-center justify-center p-10">
            <p className="text-sm text-muted-foreground">
              No registered events yet
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
