"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import type { ThresholdsData } from "@/lib/framework-admin";
import {
  saveThresholdsAction,
  type FrameworkActionState,
} from "@/app/(portal)/framework/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * FM6 — thresholds (U1-FM6): cycle total + per-category floors/ceilings.
 * Saving on the ACTIVE cycle passes the FM7 warning dialog first.
 * Locked from 31 Dec 21:00 (server-enforced too).
 */
export function ThresholdsForm({ data }: { data: ThresholdsData }) {
  const router = useRouter();
  const { cycle, categories, editable, lockAt } = data;
  const [total, setTotal] = useState(Number(cycle.totalRequired).toFixed(1));
  const [caps, setCaps] = useState(
    Object.fromEntries(
      categories.map((c) => [
        c.categoryId,
        {
          min: c.minCredits ? Number(c.minCredits).toFixed(1) : "",
          max: c.maxCredits ? Number(c.maxCredits).toFixed(1) : "",
        },
      ])
    ) as Record<string, { min: string; max: string }>
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [state, setState] = useState<FrameworkActionState>({
    status: "idle",
    error: null,
  });
  const [pending, startTransition] = useTransition();

  function submit() {
    setConfirmOpen(false);
    startTransition(async () => {
      const result = await saveThresholdsAction(cycle.id, {
        totalRequired: Number(total),
        categories: categories.map((c) => ({
          categoryId: c.categoryId,
          min: caps[c.categoryId].min === "" ? null : Number(caps[c.categoryId].min),
          max: caps[c.categoryId].max === "" ? null : Number(caps[c.categoryId].max),
        })),
      });
      setState(result);
      if (result.status === "success") router.refresh();
    });
  }

  const lockLabel = new Date(lockAt).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-foreground">Thresholds</h1>
        <p className="text-sm text-muted-foreground">
          {cycle.name} · {cycle.startsOn} → {cycle.endsOn} · editable until{" "}
          {lockLabel}
        </p>
      </div>

      <div className="flex gap-3 rounded-lg border border-status-pending-border bg-status-pending-bg px-4 py-3 text-sm">
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-status-pending" aria-hidden />
        <div>
          <p className="font-medium text-foreground">
            Adjustments lock on 31 Dec at 21:00
          </p>
          <p className="text-muted-foreground">
            Final scoring and certificate generation run after 23:59 against the
            locked values. Every change here notifies all practitioners.
          </p>
        </div>
      </div>

      {!editable && (
        <div
          role="alert"
          className="rounded-md border border-border bg-muted/60 px-4 py-3 text-sm text-muted-foreground"
        >
          Adjustments closed for this cycle.
        </div>
      )}
      {state.status === "success" && (
        <div className="rounded-md border border-status-approved-border bg-status-approved-bg px-4 py-3 text-sm text-status-approved">
          Thresholds saved — all practitioners have been notified.
        </div>
      )}
      {state.error && (
        <div
          role="alert"
          className="flex gap-2 rounded-md border border-status-rejected-border/40 bg-status-rejected-bg px-4 py-3 text-sm text-status-rejected"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {state.error}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">Cycle target</h2>
        <div className="mt-4 flex max-w-xs flex-col gap-1.5">
          <label htmlFor="th-total" className="text-sm font-medium text-foreground">
            Total credits required per cycle
          </label>
          <Input
            id="th-total"
            className="font-mono"
            inputMode="decimal"
            value={total}
            disabled={!editable}
            onChange={(e) => setTotal(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">
          Category floors &amp; ceilings
        </h2>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="pb-2 font-medium">Category</th>
              <th className="pb-2 font-medium">Floor (min)</th>
              <th className="pb-2 font-medium">Ceiling (max)</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.categoryId} className="border-t border-border">
                <td className="py-3 text-foreground">{c.name}</td>
                <td className="py-3 pr-4">
                  <Input
                    aria-label={`Floor for category ${c.code}`}
                    className="h-9 w-28 font-mono"
                    inputMode="decimal"
                    placeholder="—"
                    value={caps[c.categoryId].min}
                    disabled={!editable}
                    onChange={(e) =>
                      setCaps((p) => ({
                        ...p,
                        [c.categoryId]: { ...p[c.categoryId], min: e.target.value },
                      }))
                    }
                  />
                </td>
                <td className="py-3">
                  <Input
                    aria-label={`Ceiling for category ${c.code}`}
                    className="h-9 w-28 font-mono"
                    inputMode="decimal"
                    placeholder="—"
                    value={caps[c.categoryId].max}
                    disabled={!editable}
                    onChange={(e) =>
                      setCaps((p) => ({
                        ...p,
                        [c.categoryId]: { ...p[c.categoryId], max: e.target.value },
                      }))
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editable && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => router.push("/framework")}>
            Cancel
          </Button>
          <Button
            disabled={pending}
            aria-busy={pending}
            onClick={() => (cycle.isCurrent ? setConfirmOpen(true) : submit())}
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              "Save thresholds"
            )}
          </Button>
        </div>
      )}

      {/* FM7 — active-cycle warning */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change thresholds on the active cycle?</DialogTitle>
            <DialogDescription>
              This cycle is active. Changing thresholds affects all
              practitioners&apos; progress and eligibility immediately, and every
              practitioner will be notified.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>Confirm &amp; save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
