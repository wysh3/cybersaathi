"use client";

import { useState } from "react";

import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  FAMILY_ALERT_ENGLISH,
  FAMILY_ALERT_HINDI,
  buildFamilyAlertLink,
} from "./documents-copy";

/**
 * ShareWithFamilySheet — bottom Sheet on mobile (and right-side Sheet
 * on desktop) with the pre-written Hindi + English warning text and
 * a single "Send via WhatsApp" deep link.
 *
 * The link uses `wa.me/?text=...` so the user picks the contact inside
 * WhatsApp. The link is also exposed as plain text + a copy button so
 * it works without WhatsApp installed.
 */
export function ShareWithFamilySheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [language, setLanguage] = useState<"hi" | "en" | "both">("both");
  const text =
    language === "hi"
      ? FAMILY_ALERT_HINDI
      : language === "en"
        ? FAMILY_ALERT_ENGLISH
        : `${FAMILY_ALERT_HINDI}\n\n${FAMILY_ALERT_ENGLISH}`;
  const link = buildFamilyAlertLink(language);

  function copyLink() {
    void navigator.clipboard.writeText(link);
    toast.success("Link copied to clipboard");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[90vh] flex-col gap-4 rounded-t-3xl sm:max-w-md sm:self-end"
        data-print="hide"
      >
        <SheetHeader>
          <SheetTitle>Share with family</SheetTitle>
          <SheetDescription>
            We have prepared a Hindi + English warning. Open WhatsApp to
            send it to a contact you trust.
          </SheetDescription>
        </SheetHeader>
        <Tabs
          value={language}
          onValueChange={(v) => setLanguage(v as "hi" | "en" | "both")}
        >
          <TabsList aria-label="Warning language">
            <TabsTrigger value="hi">हिन्दी</TabsTrigger>
            <TabsTrigger value="en">English</TabsTrigger>
            <TabsTrigger value="both">Both</TabsTrigger>
          </TabsList>
        </Tabs>
        <ScrollArea className="max-h-64 rounded-md border border-border bg-muted/30 p-3">
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
            {text}
          </p>
        </ScrollArea>
        <div className="flex flex-col gap-2">
          <Button asChild size="lg" className="w-full">
            <a
              href={link}
              target="_blank"
              rel="noreferrer noopener"
              data-testid="share-via-whatsapp"
            >
              <ExternalLink aria-hidden />
              Send via WhatsApp
            </a>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={copyLink}
          >
            <Copy aria-hidden />
            Copy link
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
