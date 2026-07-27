"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import {
  revokeCertificateAction,
  type CertificateActionState,
} from "@/app/(portal)/admin/certificates/actions";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const REASONS = [
  "Issued in error — attendance unverified",
  "Issued in error — wrong practitioner or event",
  "Certificate data incorrect — revoke and re-issue",
  "Accreditation withdrawn",
  "Other",
];

/** CA3 / AI4 — revoke a certificate (destructive, permanent). */
export function RevokeDialog({
  certificateId,
  certificateNumber,
  holderName,
}: {
  certificateId: string;
  certificateNumber: string;
  holderName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [state, setState] = useState<CertificateActionState>({
    status: "idle",
    error: null,
  });
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await revokeCertificateAction({
        certificateId,
        reason,
        details: details || undefined,
      });
      setState(result);
      if (result.status === "success") {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-status-rejected hover:text-status-rejected"
          aria-label={`Revoke ${certificateNumber}`}
        >
          Revoke
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-status-rejected-bg">
              <TriangleAlert
                className="h-5 w-5 text-status-rejected"
                aria-hidden
              />
            </span>
            <div className="flex flex-col gap-1">
              <DialogTitle>Revoke certificate</DialogTitle>
              <DialogDescription className="font-mono text-[13px]">
                {certificateNumber} · {holderName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <p className="rounded-md border border-status-rejected-border bg-status-rejected-bg px-4 py-3 text-sm text-status-rejected">
            Revoking invalidates this certificate permanently. Public QR
            verification will show it as &ldquo;revoked&rdquo; and the linked
            credits will be withdrawn.
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="revoke-reason">Reason for revocation</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="revoke-reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="revoke-details">Details</Label>
            <Textarea
              id="revoke-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Add context for the audit trail"
            />
          </div>

          {state.status === "error" && (
            <p role="alert" className="text-sm text-status-rejected">
              {state.error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={pending}>
            {pending ? "Revoking…" : "Revoke certificate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
