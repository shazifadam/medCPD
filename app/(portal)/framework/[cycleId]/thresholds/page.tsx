import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getThresholds } from "@/lib/framework-admin";
import { ThresholdsForm } from "@/components/features/framework/thresholds-form";

export const metadata: Metadata = { title: "Thresholds" };
export const dynamic = "force-dynamic";

/** FM6 — per-cycle thresholds (U1-FM6 + FM7 confirm). */
export default async function ThresholdsPage({
  params,
}: {
  params: { cycleId: string };
}) {
  const data = await getThresholds(params.cycleId);
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
      <ThresholdsForm data={data} />
    </div>
  );
}
