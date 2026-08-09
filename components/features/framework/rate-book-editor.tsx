"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import type { RateBookData } from "@/lib/framework-admin";
import {
  saveRateBookAction,
  approveRateBookAction,
  type FrameworkActionState,
} from "@/app/(portal)/framework/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * FM5 — rate book (U1-FM5). One header "Edit rate book" button (no
 * per-row edits, per approved design); cycle selector navigates between
 * cycles; committee sees "Approve rate book" while draft.
 */
export function RateBookEditor({
  data,
  canApprove,
}: {
  data: RateBookData;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [state, setState] = useState<FrameworkActionState>({
    status: "idle",
    error: null,
  });
  const [pending, startTransition] = useTransition();
  const [edits, setEdits] = useState<
    Record<string, { rate: string; maxPerCycle: string }>
  >({});

  const { cycle, rules, ratesEditable, allCycles } = data;

  function valueOf(ruleId: string, key: "rate" | "maxPerCycle", fallback: string) {
    return edits[ruleId]?.[key] ?? fallback;
  }

  function save() {
    startTransition(async () => {
      const payload = rules
        .filter((r) => edits[r.id])
        .map((r) => ({
          ruleId: r.id,
          rate: Number(valueOf(r.id, "rate", r.rate)),
          maxPerCycle:
            valueOf(r.id, "maxPerCycle", r.maxPerCycle ?? "") === ""
              ? null
              : Number(valueOf(r.id, "maxPerCycle", r.maxPerCycle ?? "")),
        }));
      const result = await saveRateBookAction(cycle.id, payload);
      setState(result);
      if (result.status === "success") {
        setEditing(false);
        setEdits({});
        router.refresh();
      }
    });
  }

  function approve() {
    startTransition(async () => {
      const result = await approveRateBookAction(cycle.id);
      setState(result);
      if (result.status === "success") router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header row: title + cycle selector + actions */}
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold text-foreground">Rate book</h1>
          <p className="text-sm text-muted-foreground">
            Credit values and caps applied when awarding CPD credits
          </p>
        </div>
        <div className="flex items-center gap-2">
          {ratesEditable && !editing && (
            <Button variant="outline" onClick={() => setEditing(true)}>
              Edit rate book
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => router.push(`/framework/${cycle.id}/thresholds`)}
          >
            Edit thresholds
          </Button>
          <Select
            value={cycle.id}
            onValueChange={(id) => router.push(`/framework/${id}`)}
          >
            <SelectTrigger className="w-44" aria-label="Cycle">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allCycles.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Status banner */}
      {cycle.rateBookStatus === "draft" ? (
        <div className="flex gap-3 rounded-lg border border-border bg-accent px-4 py-3 text-sm">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
          <div>
            <p className="font-medium text-foreground">
              {cycle.name} rate book — draft, awaiting committee approval
            </p>
            <p className="text-muted-foreground">
              Rates are editable until the committee approves them, or until the
              first entry lands in this cycle — whichever comes first. After
              approval only category floors and the cycle total stay adjustable.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
          Rate book approved
          {cycle.approvedByName ? ` by ${cycle.approvedByName}` : ""} — rates are
          locked for {cycle.name}. Floors and the cycle total remain adjustable
          in Thresholds.
        </div>
      )}

      {/* Cycle total strip */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-5 py-4">
        <div>
          <p className="text-sm font-medium text-foreground">
            Total credits required this cycle
          </p>
          <p className="text-xs text-muted-foreground">
            Certification eligibility bar — adjustable in Thresholds until 31
            Dec, 21:00
          </p>
        </div>
        <p className="font-mono text-2xl font-medium text-foreground">
          {Number(cycle.totalRequired).toFixed(1)}
        </p>
      </div>

      {state.error && (
        <div
          role="alert"
          className="flex gap-2 rounded-md border border-status-rejected-border/40 bg-status-rejected-bg px-4 py-3 text-sm text-status-rejected"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {state.error}
        </div>
      )}

      {/* Rules table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Rule</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Credit value</th>
              <th className="px-4 py-3 font-medium">Cap</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-b-0">
                <td className="px-4 py-3 text-foreground">{r.activityName}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {r.categoryCode.replace("CAT", "Cat ")}
                </td>
                <td className="px-4 py-3">
                  {editing ? (
                    <Input
                      aria-label={`Rate for ${r.activityName}`}
                      className="h-8 w-24 font-mono"
                      inputMode="decimal"
                      value={valueOf(r.id, "rate", r.rate)}
                      onChange={(e) =>
                        setEdits((prev) => ({
                          ...prev,
                          [r.id]: {
                            rate: e.target.value,
                            maxPerCycle: valueOf(r.id, "maxPerCycle", r.maxPerCycle ?? ""),
                          },
                        }))
                      }
                    />
                  ) : (
                    <span className="font-mono text-foreground">
                      {Number(r.rate).toFixed(1)} · {r.method}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editing ? (
                    <Input
                      aria-label={`Cap for ${r.activityName}`}
                      className="h-8 w-24 font-mono"
                      inputMode="decimal"
                      placeholder="—"
                      value={valueOf(r.id, "maxPerCycle", r.maxPerCycle ?? "")}
                      onChange={(e) =>
                        setEdits((prev) => ({
                          ...prev,
                          [r.id]: {
                            rate: valueOf(r.id, "rate", r.rate),
                            maxPerCycle: e.target.value,
                          },
                        }))
                      }
                    />
                  ) : (
                    <span className="font-mono text-muted-foreground">
                      {r.maxPerCycle
                        ? `max ${Number(r.maxPerCycle).toFixed(1)} / ${r.capPeriod === "per_year" ? "year" : "cycle"}`
                        : "no cap"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer: edit-save / committee approval */}
      {editing && (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => {
              setEditing(false);
              setEdits({});
            }}
          >
            Cancel
          </Button>
          <Button disabled={pending} onClick={save} aria-busy={pending}>
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              "Save rate book"
            )}
          </Button>
        </div>
      )}
      {!editing && cycle.rateBookStatus === "draft" && canApprove && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-card px-5 py-4">
          <p className="text-sm text-muted-foreground">
            Committee sign-off: approving locks all entry-type rates for{" "}
            {cycle.name}.
          </p>
          <Button disabled={pending} onClick={approve} aria-busy={pending}>
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Approving…
              </>
            ) : (
              "Approve rate book"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
