"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-start justify-center gap-4 px-4 py-12 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-destructive">
            Something went wrong
          </p>
          <h1 className="font-serif-display text-3xl font-semibold tracking-tight">
            We could not load this page.
          </h1>
          <p className="text-base text-muted-foreground">
            {error.message || "An unexpected error occurred."}
          </p>
          <Button type="button" onClick={() => reset()}>
            Try again
          </Button>
        </main>
      </body>
    </html>
  );
}
