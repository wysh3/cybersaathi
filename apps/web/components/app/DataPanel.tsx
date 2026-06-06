import type { LucideIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * DataPanel — generic titled card used for grouping data on dashboards
 * and the accountability room. Always has a title, optional description,
 * and a body slot.
 */
export function DataPanel({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
  contentClassName,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={cn("h-full overflow-hidden", className)}>
      <CardHeader>
        <div className="flex flex-col gap-0.5">
          {Icon ? (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Icon className="size-3.5" aria-hidden />
              <p className="text-[11px] font-semibold uppercase tracking-wider">
                {title}
              </p>
            </div>
          ) : (
            <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {title}
            </CardTitle>
          )}
          {description ? (
            <CardDescription className="text-xs">
              {description}
            </CardDescription>
          ) : null}
        </div>
        {actions ? (
          <div className="flex items-center gap-2">{actions}</div>
        ) : null}
      </CardHeader>
      <CardContent className={cn("flex flex-col gap-3", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}

/**
 * LoadingState — skeleton placeholder matching DataPanel rhythm.
 */
export function LoadingState({
  lines = 3,
  withHeader = true,
  className,
}: {
  lines?: number;
  withHeader?: boolean;
  className?: string;
}) {
  return (
    <Card
      aria-busy="true"
      aria-live="polite"
      className={cn("h-full", className)}
    >
      <CardContent className="flex flex-col gap-3">
        {withHeader ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ) : null}
        {Array.from({ length: lines }).map((_, idx) => (
          <Skeleton
            key={idx}
            className={cn("h-3", idx === lines - 1 ? "w-2/3" : "w-full")}
          />
        ))}
      </CardContent>
    </Card>
  );
}
