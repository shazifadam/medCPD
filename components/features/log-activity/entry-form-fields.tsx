"use client";

import { format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import type { LogActivityInput } from "@/lib/schemas";
import type { ActivityTypeOption } from "@/lib/activities";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

/** LA2 — step 2 fields (title, type, date, hours/sessions, description). */
export function EntryFormFields({
  form,
  typeOptions,
}: {
  form: UseFormReturn<LogActivityInput>;
  typeOptions: ActivityTypeOption[];
}) {
  return (
    <>
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Activity title</FormLabel>
            <FormControl>
              <Input placeholder="e.g. Advanced Cardiac Life Support" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="activityTypeId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Activity type</FormLabel>
            <Select onValueChange={field.onChange} value={field.value || undefined}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select activity type" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {typeOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.categoryLabel} · {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="occurredOn"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Date</FormLabel>
            <Popover>
              <PopoverTrigger asChild>
                <FormControl>
                  <button
                    type="button"
                    className={cn(
                      "flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm",
                      field.value ? "text-foreground" : "text-muted-foreground",
                      form.formState.errors.occurredOn && "border-destructive"
                    )}
                  >
                    <CalendarIcon className="h-4 w-4 shrink-0" aria-hidden />
                    {field.value
                      ? format(parseISO(field.value), "d MMM yyyy")
                      : "Select date"}
                  </button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={field.value ? parseISO(field.value) : undefined}
                  onSelect={(d) => field.onChange(d ? format(d, "yyyy-MM-dd") : "")}
                  disabled={{ after: new Date() }}
                />
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="hoursSessions"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Hours / sessions</FormLabel>
            <FormControl>
              <Input inputMode="decimal" placeholder="e.g. 8" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Describe the activity…"
                className="h-24 resize-none"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
