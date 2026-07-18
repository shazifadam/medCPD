"use client";

import { useRef, useState } from "react";
import { ClipboardList, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * LA2/LA4 — Evidence field. Dashed dropzone until a file is chosen, then the
 * LA4 file row (accent icon tile + filename + mono size + remove ✕).
 * Uncontrolled file input rides the surrounding <form>'s FormData.
 */
export function EvidenceField({
  file,
  onFileChange,
}: {
  file: File | null;
  onFileChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function pick(picked: File | undefined) {
    onFileChange(picked ?? null);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium leading-[18px] text-foreground">
        Evidence
      </span>
      <input
        ref={inputRef}
        type="file"
        name="evidence"
        accept="application/pdf,image/jpeg,image/png"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => pick(e.target.files?.[0])}
      />
      {file ? (
        <div className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
            <ClipboardList className="h-[18px] w-[18px]" aria-hidden />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium text-foreground">
              {file.name}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {formatBytes(file.size)}
            </span>
          </div>
          <button
            type="button"
            aria-label="Remove file"
            className="shrink-0 rounded-sm p-1 text-muted-foreground hover:text-foreground"
            onClick={() => {
              if (inputRef.current) inputRef.current.value = "";
              onFileChange(null);
            }}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const dropped = e.dataTransfer.files?.[0];
            if (dropped && inputRef.current) {
              // keep the form's file input in sync with the drop
              const dt = new DataTransfer();
              dt.items.add(dropped);
              inputRef.current.files = dt.files;
            }
            pick(dropped);
          }}
          className={cn(
            "flex w-full flex-col items-center gap-1 border-[1.5px] border-dashed border-border bg-muted px-4 py-5",
            dragging && "border-primary bg-accent"
          )}
        >
          <span className="text-[13px] font-medium leading-[18px] text-foreground">
            Drag &amp; drop or browse
          </span>
          <span className="text-xs text-muted-foreground">
            PDF/JPG/PNG up to 10 MB
          </span>
        </button>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
