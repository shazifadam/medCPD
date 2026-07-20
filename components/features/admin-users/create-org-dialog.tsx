"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  createOrganizationAction,
  type UserActionState,
} from "@/app/(portal)/admin/users/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TYPES = [
  { key: "hospital", label: "Hospital" },
  { key: "clinic", label: "Clinic" },
  { key: "polyclinic", label: "Polyclinic" },
  { key: "health_centre", label: "Health centre" },
  { key: "ministry", label: "Ministry" },
  { key: "other", label: "Other" },
];

/** OG2 — register organization (compact dialog form). */
export function CreateOrgDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("hospital");
  const [state, setState] = useState<UserActionState>({
    status: "idle",
    error: null,
  });
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await createOrganizationAction({ name, type });
      setState(result);
      if (result.status === "success") {
        setOpen(false);
        setName("");
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden />
          Register organization
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Register organization</DialogTitle>
          <DialogDescription>
            Hosts and training providers whose events earn CPD credit
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="org-name"
              className="text-sm font-medium text-foreground"
            >
              Organization name
            </label>
            <Input
              id="org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Heart Institute Maldives"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="org-type"
              className="text-sm font-medium text-foreground"
            >
              Type
            </label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="org-type" aria-label="Organization type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <Button onClick={confirm} disabled={pending || !name.trim()}>
            {pending ? "Registering…" : "Register"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
