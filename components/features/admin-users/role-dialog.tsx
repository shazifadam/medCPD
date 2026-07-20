"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setRoleAction,
  type UserActionState,
} from "@/app/(portal)/admin/users/actions";
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
import { Checkbox } from "@/components/ui/checkbox";

const ROLES: { key: string; label: string; hint: string }[] = [
  { key: "practitioner", label: "Practitioner", hint: "Log CPD, attend events" },
  { key: "organizer", label: "Organizer", hint: "Create and run events" },
  {
    key: "cpd_committee",
    label: "CPD Committee",
    hint: "Review entries and accredit events",
  },
  { key: "mma_admin", label: "Super Admin", hint: "Full system access" },
];

/** UM3 — grant / revoke roles for a user. */
export function RoleDialog({
  userId,
  userName,
  activeRoles,
}: {
  userId: string;
  userName: string;
  activeRoles: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<UserActionState>({
    status: "idle",
    error: null,
  });
  const [pending, startTransition] = useTransition();

  function toggle(role: string, grant: boolean) {
    startTransition(async () => {
      const result = await setRoleAction({ userId, role, grant });
      setState(result);
      if (result.status === "success") router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label={`Manage roles for ${userName}`}>
          Manage roles
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Roles</DialogTitle>
          <DialogDescription>{userName}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {ROLES.map((r) => {
            const active = activeRoles.includes(r.key);
            return (
              <label
                key={r.key}
                className="flex cursor-pointer items-center gap-3 rounded-md border border-border px-4 py-3"
              >
                <Checkbox
                  checked={active}
                  disabled={pending}
                  onCheckedChange={(v) => toggle(r.key, v === true)}
                  aria-label={`${r.label} role`}
                />
                <span className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">
                    {r.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {r.hint}
                  </span>
                </span>
              </label>
            );
          })}
          {state.status === "error" && (
            <p role="alert" className="text-sm text-status-rejected">
              {state.error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => setOpen(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
