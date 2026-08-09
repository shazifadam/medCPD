"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  applyOverrideAction,
  type OverrideActionState,
} from "@/app/(portal)/admin/practitioner-scores/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * U1-PS2 — eligibility adjustment dialog. Reason + evidence file are
 * REQUIRED; the override is logged and the practitioner notified.
 */
export function AdjustEligibilityDialog({
  practitionerId,
  practitionerName,
  cycleName,
  categories,
}: {
  practitionerId: string;
  practitionerName: string;
  cycleName: string;
  categories: { id: string; code: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<"category_floor" | "cycle_total">(
    "cycle_total"
  );
  const [state, setState] = useState<OverrideActionState>({
    status: "idle",
    error: null,
  });
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await applyOverrideAction(
        practitionerId,
        { status: "idle", error: null },
        fd
      );
      setState(result);
      if (result.status === "success") {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setState({ status: "idle", error: null });
      }}
    >
      <DialogTrigger asChild>
        <Button>Adjust eligibility</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Adjust eligibility — {practitionerName}</DialogTitle>
          <DialogDescription>
            Overrides apply to this practitioner for {cycleName} only. The
            adjustment is written to the audit trail and the practitioner is
            notified.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {state.error && (
            <div
              role="alert"
              className="flex gap-2 rounded-md border border-status-rejected-border/40 bg-status-rejected-bg px-3 py-2 text-sm text-status-rejected"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {state.error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ov-field" className="text-sm font-medium">
                Adjust
              </label>
              <select
                id="ov-field"
                name="field"
                value={field}
                onChange={(e) =>
                  setField(e.target.value as "category_floor" | "cycle_total")
                }
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
              >
                <option value="cycle_total">Cycle total (override)</option>
                <option value="category_floor">Category floor (override)</option>
              </select>
            </div>
            {field === "category_floor" ? (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ov-category" className="text-sm font-medium">
                  Category
                </label>
                <select
                  id="ov-category"
                  name="categoryId"
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <input type="hidden" name="categoryId" value="" />
            )}
          </div>

          <div className="flex max-w-[180px] flex-col gap-1.5">
            <label htmlFor="ov-value" className="text-sm font-medium">
              New value
            </label>
            <Input
              id="ov-value"
              name="newValue"
              inputMode="decimal"
              placeholder="e.g. 40.0"
              className="font-mono"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="ov-reason" className="text-sm font-medium">
              Reason (required)
            </label>
            <Textarea
              id="ov-reason"
              name="reason"
              rows={3}
              placeholder="e.g. Practitioner joined the register in July — pro-rated targets per policy."
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="ov-evidence" className="text-sm font-medium">
              Supporting evidence (required)
            </label>
            <Input
              id="ov-evidence"
              name="evidence"
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              required
            />
            <p className="text-xs text-muted-foreground">
              Image or PDF — registration letter, leave certificate…
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending} aria-busy={pending}>
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                "Save adjustment"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
