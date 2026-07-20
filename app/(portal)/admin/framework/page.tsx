import type { Metadata } from "next";
import { format } from "date-fns";
import { sql } from "@/lib/db";

export const metadata: Metadata = { title: "Framework" };
export const dynamic = "force-dynamic";

/**
 * FM1/FM5/FM6 — framework overview + rate book (Figma 287:12947…12962),
 * read-only in v1: the framework is seeded by migration and editing it
 * mid-cycle is the FM7 warning path — deferred until MMA confirms the
 * C1 cycle total (noted deviation).
 */
export default async function FrameworkPage() {
  const [cycle] = await sql<
    {
      name: string;
      starts_on: Date | string;
      ends_on: Date | string;
      total_credits_required: string;
    }[]
  >`
    select name, starts_on, ends_on, total_credits_required
    from cpd_cycles where is_current limit 1
  `;

  const categories = await sql<
    {
      code: string;
      name: string;
      min_credits: string | null;
      max_credits: string | null;
    }[]
  >`
    select cc.code, cc.name, cap.min_credits, cap.max_credits
    from credit_categories cc
    left join cpd_cycle_category_caps cap
      on cap.category_id = cc.id
      and cap.cycle_id = (select id from cpd_cycles where is_current limit 1)
    order by cc.display_order
  `;

  const rates = await sql<
    {
      code: string;
      name: string;
      calculation_method: string;
      rate: string | null;
      max_per_cycle: string | null;
      cap_period: string | null;
      subcategory: string | null;
    }[]
  >`
    select at.code, at.name, at.calculation_method::text,
           fr.rate, fr.max_per_cycle, fr.cap_period::text,
           sc.code as subcategory
    from activity_types at
    left join credit_subcategories sc on sc.id = at.subcategory_id
    left join framework_rules fr
      on fr.activity_type_id = at.id
      and fr.role_label is null
      and fr.cycle_id = (select id from cpd_cycles where is_current limit 1)
    where at.is_active
    order by sc.display_order
  `;

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-foreground">Framework</h1>
        <p className="text-sm text-muted-foreground">
          The active credit framework — cycle, floors and the rate book
        </p>
      </div>

      {cycle && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-foreground">
              {cycle.name}
            </h2>
            <p className="text-sm text-muted-foreground">
              {format(new Date(cycle.starts_on), "d MMM yyyy")} –{" "}
              {format(new Date(cycle.ends_on), "d MMM yyyy")}
            </p>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="font-mono text-2xl font-semibold text-foreground">
              {Number(cycle.total_credits_required).toFixed(1)}
            </span>
            <span className="text-xs text-muted-foreground">
              cycle target (C1 placeholder)
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-col rounded-lg border border-border bg-card">
        <h2 className="border-b border-border px-6 py-4 text-base font-semibold text-foreground">
          Categories &amp; floors
        </h2>
        <div className="flex gap-4 bg-muted px-6 py-2.5 text-xs text-muted-foreground">
          <span className="w-16">Code</span>
          <span className="flex-1">Category</span>
          <span className="w-24 text-right">Floor</span>
          <span className="w-24 text-right">Ceiling</span>
        </div>
        {categories.map((c) => (
          <div
            key={c.code}
            className="flex items-center gap-4 border-t border-border px-6 py-3"
          >
            <span className="w-16 font-mono text-[13px] text-muted-foreground">
              {c.code}
            </span>
            <span className="flex-1 truncate text-sm text-foreground">
              {c.name}
            </span>
            <span className="w-24 text-right font-mono text-[13px] text-foreground">
              {c.min_credits != null ? Number(c.min_credits).toFixed(1) : "—"}
            </span>
            <span className="w-24 text-right font-mono text-[13px] text-foreground">
              {c.max_credits != null ? Number(c.max_credits).toFixed(1) : "—"}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col rounded-lg border border-border bg-card">
        <h2 className="border-b border-border px-6 py-4 text-base font-semibold text-foreground">
          Rate book
        </h2>
        <div className="flex gap-4 bg-muted px-6 py-2.5 text-xs text-muted-foreground">
          <span className="w-14">Tier</span>
          <span className="flex-1">Activity type</span>
          <span className="w-28">Method</span>
          <span className="w-20 text-right">Rate</span>
          <span className="w-28 text-right">Cap / cycle</span>
        </div>
        {rates.map((r) => (
          <div
            key={r.code}
            className="flex items-center gap-4 border-t border-border px-6 py-3"
          >
            <span className="w-14 font-mono text-[13px] text-muted-foreground">
              {r.subcategory ?? "—"}
            </span>
            <span className="flex-1 truncate text-sm text-foreground">
              {r.name}
            </span>
            <span className="w-28 text-sm text-muted-foreground">
              {r.calculation_method.replace("_", " ")}
            </span>
            <span className="w-20 text-right font-mono text-[13px] text-foreground">
              {r.calculation_method === "banded"
                ? "banded"
                : r.rate != null
                  ? Number(r.rate).toFixed(1)
                  : "—"}
            </span>
            <span className="w-28 text-right font-mono text-[13px] text-foreground">
              {r.max_per_cycle != null
                ? `${Number(r.max_per_cycle).toFixed(1)}${r.cap_period === "per_year" ? " / yr" : ""}`
                : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
