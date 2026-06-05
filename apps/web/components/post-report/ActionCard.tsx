"use client";

import { useState } from "react";
import { Circle, CircleCheck, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PostReportCard, PostReportItem } from "@/lib/types";

interface ActionCardProps {
  card: PostReportCard;
  onToggleStep: (label: string, status: "todo" | "done") => Promise<void>;
}

export function ActionCard({ card, onToggleStep }: ActionCardProps) {
  const [updating, setUpdating] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const handleToggle = async (item: PostReportItem) => {
    const nextStatus = item.status === "done" ? "todo" : "done";
    setUpdating((prev) => ({ ...prev, [item.label]: true }));
    try {
      await onToggleStep(item.label, nextStatus);
    } finally {
      setUpdating((prev) => ({ ...prev, [item.label]: false }));
    }
  };

  const toggleExpand = (label: string) => {
    setExpanded((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <Card className="border border-border bg-card shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold flex items-center justify-between">
          <span>{card.title}</span>
          <span className="text-xs font-medium text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">
            Priority {card.priority}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          {card.items.map((item, idx) => {
            const isDone = item.status === "done";
            const isLoading = updating[item.label];
            const isExpanded = !!expanded[item.label];
            
            return (
              <li
                key={idx}
                className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                  isDone 
                    ? "border-success/20 bg-success/5 dark:bg-success/10" 
                    : "border-border hover:bg-muted/20"
                }`}
              >
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleToggle(item)}
                  className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border border-input bg-background text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
                  aria-label={isDone ? "Mark as incomplete" : "Mark as complete"}
                >
                  {isLoading ? (
                    <Loader2 className="size-3 animate-spin text-muted-foreground" />
                  ) : isDone ? (
                    <CircleCheck className="size-4 text-success fill-success/10" />
                  ) : (
                    <Circle className="size-4 text-muted-foreground" />
                  )}
                </button>
                <div 
                  className="flex flex-1 flex-col gap-0.5 cursor-pointer"
                  onClick={() => toggleExpand(item.label)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm font-semibold leading-normal ${isDone ? "line-through text-muted-foreground font-medium" : "text-foreground font-semibold"}`}>
                      {item.label}
                    </p>
                    <span className="text-muted-foreground hover:text-foreground shrink-0 transition-colors p-0.5">
                      {isExpanded ? (
                        <ChevronDown className="size-4" />
                      ) : (
                        <ChevronRight className="size-4" />
                      )}
                    </span>
                  </div>
                  
                  {isExpanded && (
                    <div className="mt-2 text-xs text-muted-foreground leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200">
                      <p className="bg-muted/10 p-2 rounded border border-border/40">
                        {item.reason}
                      </p>
                      {item.deadline !== "none" && (
                        <span className="inline-block rounded bg-muted/60 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground mt-2">
                          Deadline: {item.deadline.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
