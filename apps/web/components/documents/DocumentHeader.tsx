"use client";

import { Printer, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

import { PageHeader } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";

/**
 * DocumentHeader — top of the documents page. Shows the helpline
 * reference badge (when captured) and the Print button that triggers
 * the `window.print()` PDF export flow powered by the print stylesheet.
 */
export function DocumentHeader({
  helplineReference,
  onPrint,
}: {
  helplineReference: string | null;
  onPrint: () => void;
}) {
  return (
    <PageHeader
      title="Case file"
      description="Editable drafts generated from your description. Submit through official channels — CyberSaathi never files on your behalf."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {helplineReference ? (
            <StatusBadge
              label={`Ref ${helplineReference}`}
              tone="primary"
              icon={Sparkles}
            />
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={onPrint}
            data-print="hide"
            className="no-print"
          >
            <Printer aria-hidden />
            Print
          </Button>
        </div>
      }
    />
  );
}
