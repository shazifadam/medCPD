"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * CT2/CT3 right-rail actions. Download is a plain link to the PDF route;
 * share copies the public /verify URL; print uses the browser dialog.
 */
export function CertActions({
  certId,
  certificateNumber,
}: {
  certId: string;
  certificateNumber: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    const url = `${window.location.origin}/verify/${certificateNumber}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-2">
      <Button asChild className="w-full">
        <a
          href={`/my-cpd/certificates/${certId}/pdf`}
          target="_blank"
          rel="noopener"
        >
          Download PDF
        </a>
      </Button>
      <Button variant="outline" className="w-full" onClick={copyLink}>
        {copied ? "Link copied" : "Share verification link"}
      </Button>
      <Button
        variant="outline"
        className="w-full"
        onClick={() => window.print()}
      >
        Print
      </Button>
    </div>
  );
}
