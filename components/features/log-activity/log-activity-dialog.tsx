"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { logActivitySchema, type LogActivityInput } from "@/lib/schemas";
import type { ActivityTypeOption } from "@/lib/activities";
import {
  logActivityAction,
  type LogActivityState,
} from "@/app/(portal)/dashboard/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { CategoryStep } from "./category-step";
import { EntryFormFields } from "./entry-form-fields";
import { EvidenceField } from "./evidence-field";
import { PreRegCallout, SuccessView, ValidationCallout } from "./callouts";

/**
 * LA1–LA7 — the two-step "Log CPD activity" dialog over the dashboard.
 * Step 1 picks a category (cards) or a specific type (select shortcut);
 * step 2 is the entry form with the LA5 error and LA6 pre-reg states;
 * success swaps to the compact LA7 view.
 */
export function LogActivityDialog({
  options,
}: {
  options: ActivityTypeOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [categoryCode, setCategoryCode] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<LogActivityState>({
    status: "idle",
    error: null,
  });
  const [pending, startTransition] = useTransition();

  const form = useForm<LogActivityInput>({
    resolver: zodResolver(logActivitySchema),
    defaultValues: {
      title: "",
      activityTypeId: "",
      occurredOn: "",
      hoursSessions: "",
      description: "",
    },
  });

  const selectedType = options.find(
    (o) => o.id === form.watch("activityTypeId")
  );
  // Step 2's select is scoped to the chosen category (step-1 pick).
  const scopedOptions = useMemo(
    () =>
      categoryCode
        ? options.filter((o) => o.categoryCode === categoryCode)
        : options,
    [options, categoryCode]
  );

  function reset() {
    setStep(1);
    setCategoryCode(null);
    setFile(null);
    setState({ status: "idle", error: null });
    form.reset();
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  function onSubmit(values: LogActivityInput) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("title", values.title);
      fd.set("activityTypeId", values.activityTypeId);
      fd.set("occurredOn", values.occurredOn);
      fd.set("hoursSessions", values.hoursSessions);
      fd.set("description", values.description ?? "");
      if (file) fd.set("evidence", file);
      setState(await logActivityAction({ status: "idle", error: null }, fd));
    });
  }

  function done() {
    setOpen(false);
    reset();
    router.refresh();
  }

  const success = state.status === "success";
  // LA5 — callout on failed client validation or server error.
  const showError =
    state.status === "error" ||
    (step === 2 && form.formState.submitCount > 0 && !form.formState.isValid);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden />
          Log CPD activity
        </Button>
      </DialogTrigger>
      <DialogContent
        className={cn("gap-0 p-0", success ? "max-w-[400px]" : "max-w-[560px]")}
      >
        {success ? (
          <div className="p-6">
            <SuccessView onDone={done} />
          </div>
        ) : (
          <>
            <DialogHeader className="px-6 pb-5 pt-6 text-left">
              <DialogTitle className="text-xl font-medium">
                Log CPD activity
              </DialogTitle>
              {step === 1 ? (
                <DialogDescription className="text-[13px]">
                  Choose what you&apos;d like to log
                </DialogDescription>
              ) : (
                <DialogDescription className="sr-only">
                  Enter the activity details
                </DialogDescription>
              )}
            </DialogHeader>

            {step === 1 ? (
              <>
                <div className="px-6 pb-5">
                  <CategoryStep
                    options={options}
                    categoryCode={categoryCode}
                    activityTypeId={form.watch("activityTypeId")}
                    onPickCategory={(code) => {
                      setCategoryCode(code);
                      // a type from another category no longer applies
                      if (selectedType && selectedType.categoryCode !== code) {
                        form.setValue("activityTypeId", "");
                      }
                    }}
                    onPickType={(id) => {
                      form.setValue("activityTypeId", id);
                      const t = options.find((o) => o.id === id);
                      if (t) setCategoryCode(t.categoryCode);
                    }}
                  />
                </div>
                <DialogFooter className="border-t border-border px-6 py-4">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => setStep(2)}
                    disabled={!categoryCode && !selectedType}
                  >
                    Continue
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
                  <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto px-6 pb-5">
                    {showError && <ValidationCallout message={state.error} />}
                    {selectedType?.preRegistration === "required" && (
                      <PreRegCallout
                        subcategoryCode={selectedType.subcategoryCode}
                      />
                    )}
                    <EntryFormFields form={form} typeOptions={scopedOptions} />
                    <EvidenceField file={file} onFileChange={setFile} />
                  </div>
                  <DialogFooter className="border-t border-border px-6 py-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={pending}>
                      {pending ? "Submitting…" : "Submit for review"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
