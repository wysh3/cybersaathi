import { Inbox } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/**
 * EmptyState — for "no complaint yet" / "no cluster" / "no similarity match"
 * screens. Always offers a next action when possible.
 */
export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  primaryAction,
  secondaryAction,
  className,
}: {
  title: string;
  description?: string;
  icon?: typeof Inbox;
  primaryAction?: { label: string; href?: string; onClick?: () => void };
  secondaryAction?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}) {
  return (
    <Empty className={className}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
      {(primaryAction || secondaryAction) && (
        <EmptyContent>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {primaryAction ? (
              <Button
                asChild={Boolean(primaryAction.href)}
                onClick={primaryAction.onClick}
              >
                {primaryAction.href ? (
                  <a href={primaryAction.href}>{primaryAction.label}</a>
                ) : (
                  primaryAction.label
                )}
              </Button>
            ) : null}
            {secondaryAction ? (
              <Button
                variant="outline"
                asChild={Boolean(secondaryAction.href)}
                onClick={secondaryAction.onClick}
              >
                {secondaryAction.href ? (
                  <a href={secondaryAction.href}>{secondaryAction.label}</a>
                ) : (
                  secondaryAction.label
                )}
              </Button>
            ) : null}
          </div>
        </EmptyContent>
      )}
    </Empty>
  );
}
