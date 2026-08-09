import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import {
  getScoreDetail,
  listCategoryOptions,
} from "@/lib/practitioner-scores";
import { getDownloadUrl } from "@/lib/storage";
import { AdjustEligibilityDialog } from "@/components/features/practitioner-scores/adjust-dialog";

export const metadata: Metadata = { title: "Practitioner scores" };
export const dynamic = "force-dynamic";

/** U1-PS2 — practitioner score detail + eligibility overrides panel. */
export default async function PractitionerScoreDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [detail, categories] = await Promise.all([
    getScoreDetail(params.id),
    listCategoryOptions(),
  ]);
  if (!detail) notFound();
  const { profile, bundle, history } = detail;

  const evidenceLinks = await Promise.all(
    history.map(async (h) => ({
      id: h.id,
      url: await getDownloadUrl("cpd-adjustments", h.evidencePath).catch(
        () => null
      ),
    }))
  );
  const evidenceById = Object.fromEntries(
    evidenceLinks.map((l) => [l.id, l.url])
  );

  const registration = profile.mmdc_registration
    ? `${profile.mmdc_registration_type ?? ""}${profile.mmdc_registration_type ? "-" : ""}${profile.mmdc_registration}`
    : null;

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <Link
        href="/admin/practitioner-scores"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Practitioner scores
      </Link>

      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold text-foreground">
            {profile.full_name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {[registration, profile.specialty, profile.email]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {bundle && (
          <AdjustEligibilityDialog
            practitionerId={profile.id}
            practitionerName={profile.full_name}
            cycleName={bundle.cycle.name}
            categories={categories}
          />
        )}
      </div>

      {bundle ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Counted total
              </p>
              <p className="mt-1 font-mono text-2xl font-medium text-foreground">
                {bundle.progress.countedTotal.toFixed(1)}
                <span className="text-sm text-muted-foreground">
                  {" "}
                  / {bundle.cycle.target.toFixed(0)}
                </span>
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Cycle
              </p>
              <p className="mt-1 text-lg font-medium text-foreground">
                {bundle.cycle.name}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Completion
              </p>
              <p className="mt-1 text-lg font-medium text-foreground">
                {bundle.progress.complete ? "Eligible" : "Not yet eligible"}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Counted</th>
                  <th className="px-4 py-3 font-medium">Floor (effective)</th>
                  <th className="px-4 py-3 font-medium">Floor met</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(bundle.progress.perCategory).map(
                  ([code, p]) => {
                    const floor = bundle.fw.categoryCaps[code]?.min ?? null;
                    return (
                      <tr
                        key={code}
                        className="border-b border-border last:border-b-0"
                      >
                        <td className="px-4 py-3 text-foreground">
                          {code.replace("CAT", "Category ")}
                        </td>
                        <td className="px-4 py-3 font-mono">
                          {p.counted.toFixed(1)}
                        </td>
                        <td className="px-4 py-3 font-mono text-muted-foreground">
                          {floor != null ? floor.toFixed(1) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {floor == null
                            ? "—"
                            : p.counted >= floor
                              ? "Yes"
                              : "No"}
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No active cycle.</p>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">
          Adjustment history
        </h2>
        {history.length === 0 ? (
          <p className="rounded-lg border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
            No eligibility adjustments for this practitioner.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {history.map((h) => (
              <li
                key={h.id}
                className="rounded-lg border border-border bg-card px-4 py-3 text-sm"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-medium text-foreground">
                    {h.field === "cycle_total"
                      ? "Cycle total"
                      : `${(h.categoryCode ?? "").replace("CAT", "Category ")} floor`}
                    {": "}
                    <span className="font-mono">
                      {h.oldValue ? Number(h.oldValue).toFixed(1) : "—"} →{" "}
                      {Number(h.newValue).toFixed(1)}
                    </span>
                  </p>
                  <p className="shrink-0 text-xs text-muted-foreground">
                    {new Date(h.createdAt).toLocaleDateString("en-GB")}
                    {h.adjustedByName ? ` · ${h.adjustedByName}` : ""}
                  </p>
                </div>
                <p className="mt-1 text-muted-foreground">{h.reason}</p>
                {evidenceById[h.id] && (
                  <a
                    href={evidenceById[h.id]!}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <FileText className="h-3.5 w-3.5" aria-hidden />
                    View evidence
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
