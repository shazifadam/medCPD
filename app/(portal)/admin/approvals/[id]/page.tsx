import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { sql } from "@/lib/db";
import { getApplicant } from "@/lib/approvals";
import { cn } from "@/lib/utils";
import {
  ApproveDialog,
  RejectDialog,
} from "@/components/features/approvals/decision-dialogs";

export const metadata: Metadata = { title: "Applicant review" };
export const dynamic = "force-dynamic";

const STATE_PILL = {
  pending: {
    label: "Pending approval",
    className:
      "border-status-pending-border bg-status-pending-bg text-status-pending",
  },
  verified: {
    label: "Approved",
    className:
      "border-status-approved-border bg-status-approved-bg text-status-approved",
  },
  rejected: {
    label: "Rejected",
    className:
      "border-status-rejected-border bg-status-rejected-bg text-status-rejected",
  },
} as const;

/**
 * RA2 — applicant review (Figma 287:12816). Signup collects fewer fields
 * than the designed frame (no IC/passport, qualification, practice, or
 * verification documents in P1) — those sections render from what exists.
 */
export default async function ApplicantReviewPage({
  params,
}: {
  params: { id: string };
}) {
  const applicant = await getApplicant(params.id);
  if (!applicant) notFound();

  const [cycle] = await sql<{ name: string }[]>`
    select name from cpd_cycles where is_current limit 1
  `;

  const pill = STATE_PILL[applicant.state];
  const details: [string, string][] = [
    ["Full name", applicant.fullName],
    ["Email", applicant.email],
    ["Phone", applicant.phone ?? "—"],
    [
      "Registration type",
      applicant.registrationType === "TMR"
        ? "Temporary registration"
        : applicant.registrationType === "PMR"
          ? "Full registration"
          : "—",
    ],
    ["MMDC number", applicant.registrationNumber ?? "—"],
    ["Specialty", applicant.specialty ?? "—"],
  ];

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <Link
        href="/admin/approvals"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Registration approvals
      </Link>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-semibold text-foreground">
            {applicant.fullName}
          </h1>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-[9px] py-[3px] text-xs",
              pill.className
            )}
          >
            {pill.label}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Applied {format(parseISO(applicant.submittedAt), "d MMM yyyy")} ·{" "}
          {applicant.email}
        </p>
      </div>

      <div className="grid grid-cols-[1fr_340px] items-start gap-6">
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">
            Applicant details
          </h2>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
            {details.map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-sm text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
          {applicant.state === "rejected" && applicant.rejectionReason && (
            <p className="rounded-md bg-status-rejected-bg px-4 py-3 text-sm text-status-rejected">
              Rejected: {applicant.rejectionReason}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground">Decision</h2>
            <p className="text-sm text-muted-foreground">
              Approve to grant the practitioner role and activate the account,
              or reject with a reason.
            </p>
            {applicant.state === "verified" ? (
              <p className="rounded-md bg-status-approved-bg px-4 py-3 text-sm text-status-approved">
                Approved
                {applicant.verifiedAt
                  ? ` · ${format(parseISO(applicant.verifiedAt), "d MMM yyyy")}`
                  : ""}
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                <ApproveDialog
                  applicantId={applicant.id}
                  applicantName={applicant.fullName}
                  registrationNumber={applicant.registrationNumber}
                  cycleName={cycle?.name ?? null}
                />
                {applicant.state === "pending" && (
                  <RejectDialog
                    applicantId={applicant.id}
                    applicantName={applicant.fullName}
                    registrationNumber={applicant.registrationNumber}
                  />
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground">
              Application
            </h2>
            <dl className="flex flex-col gap-2.5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Submitted</dt>
                <dd className="font-medium text-foreground">
                  {format(parseISO(applicant.submittedAt), "d MMM yyyy")}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Channel</dt>
                <dd className="font-medium text-foreground">Web sign-up</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
