"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export interface OrgOption {
  id: string;
  name: string;
}

/**
 * Organization select-or-create combobox (U1-EM1 / U1-AU3 / U1-PF1).
 * Emits a hidden form field: `id:<uuid>` for an existing organization or
 * `new:<name>` for one typed in — the server action resolves/creates it.
 * `locked` renders a read-only field (organization users are pinned to
 * their own institution).
 */
export function OrgCombobox({
  fieldName,
  options,
  placeholder = "Search or select an organization…",
  locked = false,
  defaultOption = null,
  triggerId,
  onValueChange,
}: {
  fieldName: string;
  options: OrgOption[];
  placeholder?: string;
  locked?: boolean;
  defaultOption?: OrgOption | null;
  triggerId?: string;
  /** Optional change callback (react-hook-form integration). */
  onValueChange?: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{ value: string; label: string } | null>(
    defaultOption ? { value: `id:${defaultOption.id}`, label: defaultOption.name } : null
  );

  const trimmed = query.trim();
  const hasExactMatch = useMemo(
    () => options.some((o) => o.name.toLowerCase() === trimmed.toLowerCase()),
    [options, trimmed]
  );

  if (locked) {
    return (
      <>
        <input type="hidden" name={fieldName} value={selected?.value ?? ""} />
        <div
          id={triggerId}
          aria-disabled
          className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground"
        >
          {selected?.label ?? "—"}
        </div>
      </>
    );
  }

  return (
    <>
      <input type="hidden" name={fieldName} value={selected?.value ?? ""} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={triggerId}
            role="combobox"
            aria-expanded={open}
            className={cn(
              "flex h-10 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 text-sm shadow-sm",
              selected ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {selected?.label ?? placeholder}
            <ChevronDown className="h-4 w-4 opacity-50" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] p-0"
        >
          <Command>
            <CommandInput
              placeholder="Type a name…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>No organization found.</CommandEmpty>
              <CommandGroup>
                {options.map((o) => (
                  <CommandItem
                    key={o.id}
                    value={o.name}
                    onSelect={() => {
                      setSelected({ value: `id:${o.id}`, label: o.name });
                      onValueChange?.(`id:${o.id}`);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selected?.value === `id:${o.id}` ? "opacity-100" : "opacity-0"
                      )}
                      aria-hidden
                    />
                    {o.name}
                  </CommandItem>
                ))}
                {trimmed.length >= 2 && !hasExactMatch && (
                  <CommandItem
                    value={`__create__${trimmed}`}
                    onSelect={() => {
                      setSelected({ value: `new:${trimmed}`, label: trimmed });
                      onValueChange?.(`new:${trimmed}`);
                      setOpen(false);
                    }}
                    className="text-primary"
                  >
                    <Plus className="mr-2 h-4 w-4" aria-hidden />
                    Create &ldquo;{trimmed}&rdquo;
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
