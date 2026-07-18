import type { Metadata } from "next";
import { listApplicants } from "@/lib/approvals";
import { ApplicantsTable } from "@/components/features/approvals/applicants-table";

export const metadata: Metadata = { title: "Registration approvals" };
export const dynamic = "force-dynamic";

/** RA1 — signup approval queue (Figma 287:12813). Admin layout guards. */
export default async function ApprovalsPage() {
  const rows = await listApplicants();

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-foreground">
          Registration approvals
        </h1>
        <p className="text-sm text-muted-foreground">
          New practitioner sign-ups awaiting verification and approval
        </p>
      </div>
      <ApplicantsTable rows={rows} />
    </div>
  );
}
