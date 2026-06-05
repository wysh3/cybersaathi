"use client";

import { FileSpreadsheet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface EvidenceChecklistProps {
  items: string[];
}

export function EvidenceChecklist({ items }: EvidenceChecklistProps) {
  if (!items || items.length === 0) return null;
  return (
    <Card className="bg-muted/10 border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="size-5 text-muted-foreground" />
          <CardTitle className="text-base font-semibold">Evidence to preserve</CardTitle>
        </div>
        <CardDescription>
          Keep these items safe. Do not delete them; they are critical for police and bank coordination.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-1.5 list-disc pl-5">
          {items.map((item, idx) => (
            <li key={idx} className="text-xs font-medium text-muted-foreground">
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
