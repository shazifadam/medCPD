"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MoreHorizontal } from "lucide-react";
import {
  verifyOrganizationAction,
  updateOrganizationAction,
  archiveOrganizationAction,
  restoreOrganizationAction,
} from "@/app/(portal)/organizations/actions";
import { ORG_TYPE_OPTIONS } from "@/lib/org-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Per-row organization actions behind a ⋯ menu (design-system dropdown):
 * Verify (unverified only) · Edit · Archive — or Restore when archived.
 */
export function OrgRowActions({
  org,
}: {
  org: {
    id: string;
    name: string;
    type: string;
    isActive: boolean;
    isVerified: boolean;
  };
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<"verify" | "edit" | "archive" | null>(
    null
  );
  const [name, setName] = useState(org.name);
  const [type, setType] = useState(org.type);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ status: string; error: string | null }>) {
    startTransition(async () => {
      const result = await action();
      if (result.status === "error") {
        setError(result.error);
        return;
      }
      setDialog(null);
      setError(null);
      router.refresh();
    });
  }

  function closeDialog(open: boolean) {
    if (!open) {
      setDialog(null);
      setError(null);
    }
  }

  const spinner = (label: string, busy: string) =>
    pending ? (
      <>
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {busy}
      </>
    ) : (
      label
    );

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={`Actions for ${org.name}`}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {org.isActive ? (
            <>
              {!org.isVerified && (
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setMenuOpen(false); setDialog("verify"); }}>
                  Verify organization
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setMenuOpen(false); setDialog("edit"); }}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={(e) => { e.preventDefault(); setMenuOpen(false); setDialog("archive"); }}
              >
                Archive
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem
              onSelect={() => run(() => restoreOrganizationAction(org.id))}
            >
              Restore
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Verify */}
      <Dialog open={dialog === "verify"} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify {org.name}?</DialogTitle>
            <DialogDescription>
              Marks this organization as a verified provider. Verified status
              is shown wherever the organization appears (events, workplaces,
              provider lists).
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-sm text-status-rejected">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setDialog(null)}
            >
              Cancel
            </Button>
            <Button
              disabled={pending}
              aria-busy={pending}
              onClick={() => run(() => verifyOrganizationAction(org.id))}
            >
              {spinner("Verify organization", "Verifying…")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={dialog === "edit"} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit organization</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {error && (
              <p role="alert" className="text-sm text-status-rejected">
                {error}
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`edit-name-${org.id}`}
                className="text-sm font-medium"
              >
                Name
              </label>
              <Input
                id={`edit-name-${org.id}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`edit-type-${org.id}`}
                className="text-sm font-medium"
              >
                Type
              </label>
              <select
                id={`edit-type-${org.id}`}
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
              >
                {ORG_TYPE_OPTIONS.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
                {org.type === "polyclinic" && (
                  <option value="polyclinic">Polyclinic (legacy)</option>
                )}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setDialog(null)}
            >
              Cancel
            </Button>
            <Button
              disabled={pending}
              aria-busy={pending}
              onClick={() =>
                run(() => updateOrganizationAction(org.id, { name, type }))
              }
            >
              {spinner("Save", "Saving…")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive */}
      <Dialog open={dialog === "archive"} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive {org.name}?</DialogTitle>
            <DialogDescription>
              Archiving removes this organization from every selection menu
              (event organizer, workplaces). Practitioners who already have it
              as a workplace, and events that reference it, keep it — nothing
              is deleted. You can restore it later from the archived list.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-sm text-status-rejected">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setDialog(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              aria-busy={pending}
              onClick={() => run(() => archiveOrganizationAction(org.id))}
            >
              {spinner("Archive organization", "Archiving…")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
