import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { AlertTriangle, ArrowLeft, ClipboardList, Clock } from "lucide-react";
import { getIdentity } from "@/lib/auth/identity";
import { getEntryDetail } from "@/lib/entries";
import { getDownloadUrl } from "@/lib/storage";
import { StatusBadge } from "@/components/features/entries/status-badge";
import { WithdrawButton } from "@/components/features/entries/withdraw-button";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "CPD entry" };
export const dynamic = "force-dynamic";

/**
 * EN4–EN6 — entry detail (Figma 287:12880/12883/12886): activity details +
 * evidence cards with a Review side panel that branches by status. EN6's
 * "Revise & resubmit" routes to My CPD to log a corrected entry (the static
 * frame can't show a prefilled reopen — deliberate v1 simplification).
 */
export default async function EntryDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const identity = await getIdentity();
  if (!identity) redirect("/login");

  const entry = await getEntryDetail(identity.user.id, params.id);
  if (!entry) notFound();

  const metaLine = [
    entry.categoryLabel,
    format(parseISO(entry.occurredOn), "d MMM yyyy"),
    `${entry.credits.toFixed(1)} credits`,
  ].join(" · ");

  const amountLabel = entry.sessions != null ? "Sessions" : "Hours";
  const amount = entry.sessions ?? entry.hours;

  const attachments = await Promise.all(
    entry.attachments.map(async (a) => ({
      ...a,
      url: await getDownloadUrl(a.storageBucket, a.storagePath),
    }))
  );

  const details: [string, string][] = [
    ["Activity type", entry.activityTypeName],
    ["Date", format(parseISO(entry.occurredOn), "d MMM yyyy")],
    ...(amount != null ? [[amountLabel, String(amount)] as [string, string]] : []),
    ["Credits", entry.credits.toFixed(1)],
  ];

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <Link
        href="/my-cpd"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to My CPD
      </Link>

      <div className="flex flex-col gap-1 border-b border-border pb-4">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold text-foreground">
            {entry.title}
          </h1>
          <StatusBadge status={entry.status} />
        </div>
        <p className="text-sm text-muted-foreground">{metaLine}</p>
      </div>

      <div className="grid grid-cols-[1fr_340px] items-start gap-6">
        <div className="flex flex-col gap-6">
          {/* Activity details */}
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground">
              Activity details
            </h2>
            <dl className="flex flex-col">
              {details.map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center gap-6 border-b border-border/60 py-2.5 last:border-0"
                >
                  <dt className="w-40 shrink-0 text-sm text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="text-sm text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
            {entry.description && (
              <div className="flex flex-col gap-2 border-t border-border pt-4">
                <h3 className="text-sm text-muted-foreground">Description</h3>
                <p className="text-sm leading-6 text-foreground">
                  {entry.description}
                </p>
              </div>
            )}
          </div>

          {/* Evidence */}
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground">Evidence</h2>
            {attachments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No evidence attached.
              </p>
            ) : (
              attachments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-3 rounded-md bg-muted px-4 py-3"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
                    <ClipboardList className="h-[18px] w-[18px]" aria-hidden />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">
                      {a.filename}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatBytes(a.sizeBytes)}
                    </span>
                  </div>
                  <a
                    href={a.url}
                    download={a.filename}
                    className="text-sm font-medium text-foreground hover:text-primary"
                  >
                    Download
                  </a>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Review panel */}
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Review</h2>

          {entry.status === "pending" && (
            <>
              <p className="flex items-center gap-2 text-sm font-medium text-status-pending">
                <Clock className="h-4 w-4" aria-hidden />
                Awaiting review
              </p>
              <p className="text-sm text-muted-foreground">
                Your entry is in the review queue.
              </p>
              <div className="border-t border-border pt-4">
                <WithdrawButton entryId={entry.id} />
              </div>
            </>
          )}

          {entry.status === "approved" && (
            <>
              <StatusBadge status="approved" className="self-start" />
              <p className="text-sm text-muted-foreground">
                Reviewed by CPD Committee
                {entry.reviewedAt
                  ? ` · ${format(parseISO(entry.reviewedAt), "d MMM yyyy")}`
                  : ""}
              </p>
              {entry.reviewComments && (
                <p className="border-t border-border pt-4 text-sm text-foreground">
                  {entry.reviewComments}
                </p>
              )}
            </>
          )}

          {entry.status === "rejected" && (
            <>
              <div
                role="status"
                className="flex flex-col gap-1 rounded-md border border-status-rejected-border/40 bg-status-rejected-bg p-4 text-sm text-status-rejected"
              >
                <p className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4" aria-hidden />
                  Rejected
                  {entry.reviewedAt
                    ? ` — ${format(parseISO(entry.reviewedAt), "d MMM yyyy")}`
                    : ""}
                </p>
                {entry.reviewComments && <p>{entry.reviewComments}</p>}
              </div>
              <Button asChild className="w-full">
                <Link href="/my-cpd">Revise &amp; resubmit</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
