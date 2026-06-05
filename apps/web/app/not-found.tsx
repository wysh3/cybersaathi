import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-start justify-center gap-4 px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        404
      </p>
      <h1 className="font-serif-display text-3xl font-semibold tracking-tight text-foreground">
        We could not find that page.
      </h1>
      <p className="text-base text-muted-foreground">
        The link may be old. Start a new intake to get to the right flow.
      </p>
      <Button asChild>
        <Link href="/">Open intake</Link>
      </Button>
    </div>
  );
}
