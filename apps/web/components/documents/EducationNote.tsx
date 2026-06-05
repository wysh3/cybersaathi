"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { ShareWithFamilySheet } from "./ShareWithFamilySheet";

/**
 * EducationNote — post-action cool-down content shown on the
 * Documents page once drafts are generated. F005 ships the visual
 * surface and the share-with-family affordance; the actual deep link
 * lives in ShareWithFamilySheet.
 */
export function EducationNote() {
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <>
      <Card
        data-print="hide"
        className="no-print border-primary/20 bg-primary/5"
        data-testid="education-note"
      >
        <CardHeader>
          <div className="flex flex-col gap-1.5">
            <CardTitle>What to do in the next 60 minutes</CardTitle>
            <CardDescription>
              Your complaint package is ready. Before you submit, share
              this warning with family so they recognise the same scam.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ul className="flex flex-col gap-2 text-sm text-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 inline-block size-1.5 shrink-0 rounded-full bg-primary" />
              Forward the warning below to a family member over WhatsApp.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 inline-block size-1.5 shrink-0 rounded-full bg-primary" />
              Ask them to call you before they pay or share any code,
              even if the message looks official.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 inline-block size-1.5 shrink-0 rounded-full bg-primary" />
              Save the helpline reference number from 1930 so the next
              family member can quote it if they get targeted.
            </li>
          </ul>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShareOpen(true)}
              data-testid="share-with-family"
            >
              <Share2 aria-hidden />
              Share with family
            </Button>
            <p className="text-xs text-muted-foreground">
              Opens WhatsApp with a pre-written Hindi + English warning.
              You pick the contact.
            </p>
          </div>
        </CardContent>
      </Card>
      <ShareWithFamilySheet open={shareOpen} onOpenChange={setShareOpen} />
    </>
  );
}
