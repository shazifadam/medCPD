"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DIAL_CODES,
  DEFAULT_DIAL_CODE,
  findDialCode,
  type DialCodeOption,
} from "@/lib/phone";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface PhoneInputProps
  extends Omit<React.ComponentProps<"input">, "type" | "value" | "onChange"> {
  /** The selected calling code, e.g. "+960". */
  dialCode: string;
  onDialCodeChange: (dial: string) => void;
  /** National number (digits only — non-digits are stripped as you type). */
  value: string;
  onChange: (value: string) => void;
}

/**
 * Contact-number field: a country-code combobox and the national number
 * sharing ONE bordered box. Locked to +960 (Maldives) by default.
 *
 * The outer div mirrors the `Input` primitive's box so the pair reads as a
 * single control; `...props` and the ref land on the inner <input>, which is
 * what `FormControl` labels and describes.
 */
export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  (
    { dialCode, onDialCodeChange, value, onChange, className, ...props },
    ref
  ) => {
    const [open, setOpen] = React.useState(false);
    const selected: DialCodeOption =
      findDialCode(dialCode) ?? findDialCode(DEFAULT_DIAL_CODE)!;

    // Pasting a full international number keeps the code out of the digits.
    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      let next = e.target.value;
      const trimmed = next.trim();
      if (trimmed.startsWith("+")) {
        const match = [...DIAL_CODES]
          .sort((a, b) => b.dial.length - a.dial.length)
          .find((c) => trimmed.startsWith(c.dial));
        if (match) {
          if (match.dial !== dialCode) onDialCodeChange(match.dial);
          next = trimmed.slice(match.dial.length);
        }
      }
      onChange(next.replace(/\D/g, ""));
    }

    return (
      <div
        className={cn(
          "flex h-9 w-full items-center rounded-md border border-input bg-transparent shadow-sm transition-colors focus-within:outline-none focus-within:ring-1 focus-within:ring-ring has-[input[aria-invalid=true]]:border-destructive has-[input[aria-invalid=true]]:focus-within:ring-destructive",
          className
        )}
      >
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              // aria-controls / aria-haspopup are injected by Radix's
              // PopoverTrigger at runtime (asChild) — eslint can't see them.
              // eslint-disable-next-line jsx-a11y/role-has-required-aria-props
              role="combobox"
              aria-expanded={open}
              aria-label={`Country code: ${selected.name} ${selected.dial}`}
              className="flex h-full shrink-0 items-center gap-1 rounded-l-md pl-3 pr-2 text-sm text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              disabled={props.disabled}
            >
              <span aria-hidden>{selected.flag}</span>
              <span className="font-medium">{selected.dial}</span>
              <ChevronDown className="h-4 w-4 opacity-50" aria-hidden />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[280px] p-0">
            <Command
              filter={(itemValue, search) =>
                itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
              }
            >
              <CommandInput placeholder="Search country or code" />
              <CommandList>
                <CommandEmpty>No country found.</CommandEmpty>
                <CommandGroup>
                  {DIAL_CODES.map((country) => (
                    <CommandItem
                      key={country.code}
                      value={`${country.name} ${country.dial} ${country.code}`}
                      onSelect={() => {
                        onDialCodeChange(country.dial);
                        setOpen(false);
                      }}
                    >
                      <span className="mr-2" aria-hidden>
                        {country.flag}
                      </span>
                      <span className="flex-1 truncate">{country.name}</span>
                      <span className="ml-2 text-muted-foreground">
                        {country.dial}
                      </span>
                      <Check
                        className={cn(
                          "ml-2 h-4 w-4",
                          country.dial === selected.dial
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                        aria-hidden
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <span className="h-5 w-px shrink-0 bg-border" aria-hidden />

        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={value}
          onChange={handleChange}
          className="h-full w-full min-w-0 rounded-r-md bg-transparent px-3 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          ref={ref}
          {...props}
        />
      </div>
    );
  }
);
PhoneInput.displayName = "PhoneInput";
