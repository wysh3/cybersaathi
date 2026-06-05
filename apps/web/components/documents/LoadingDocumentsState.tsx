import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { PageHeader } from "@/components/app/PageHeader";

/**
 * LoadingDocumentsState — full-page skeleton while the documents API
 * resolves. Mirrors the rhythm of the real workspace so the layout
 * does not jump on hydration.
 */
export function LoadingDocumentsState() {
  return (
    <div
      className="mx-auto flex w-full max-w-6xl flex-col gap-4"
      data-print="root"
    >
      <PageHeader
        eyebrow="Complaint package"
        title="Generating documents…"
        description="We're extracting facts and building the editable drafts."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex flex-col gap-2">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-3 w-1/4" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </CardContent>
      </Card>
    </div>
  );
}
