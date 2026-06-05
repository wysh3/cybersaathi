"use client";

import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DoNotDoCardProps {
  items: string[];
}

export function DoNotDoCard({ items }: DoNotDoCardProps) {
  if (!items || items.length === 0) return null;
  return (
    <Card className="border-destructive/30 bg-destructive/5 dark:bg-destructive/10">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <AlertTriangle className="size-5 text-destructive" />
        <CardTitle className="text-sm font-bold uppercase tracking-wider text-destructive">
          Critical Safety Safeguards
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2">
          {items.map((item, idx) => (
            <li key={idx} className="text-sm font-semibold text-destructive/90 flex items-start gap-2">
              <span className="select-none">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
