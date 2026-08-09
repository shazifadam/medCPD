import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getIdentity, hasRole } from "@/lib/auth/identity";
import { getRateBook } from "@/lib/framework-admin";
import { RateBookEditor } from "@/components/features/framework/rate-book-editor";

export const metadata: Metadata = { title: "Rate book" };
export const dynamic = "force-dynamic";

/** FM5 — per-cycle rate book (U1-FM5). */
export default async function RateBookPage({
  params,
}: {
  params: { cycleId: string };
}) {
  const [identity, data] = await Promise.all([
    getIdentity(),
    getRateBook(params.cycleId),
  ]);
  if (!data) notFound();

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
      <Link
        href="/framework"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Framework
      </Link>
      <RateBookEditor
        data={data}
        canApprove={identity ? hasRole(identity, "cpd_committee") : false}
      />
    </div>
  );
}
