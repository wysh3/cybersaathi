# Document Page & Component Layout Rules

## Document page: no duplicate action cards

The `/documents` page uses `DocumentWorkspace` which already contains a `TabsList` with
"NCRP draft", "Bank email", "Timeline", "Checklist" tabs inside its Card component.
Do NOT render a separate `DocumentActionCard` grid above it — those cards are
non-functional duplicates. The page layout should go directly from `DocumentHeader`
to the `DocumentWorkspace` + sidebar.

### Correct layout
```tsx
<DocumentHeader helplineReference={...} onPrint={...} />
<div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
  <div>
    <DocumentWorkspace documents={documents} />
  </div>
  <aside className="flex flex-col gap-4">
    <RecoveryOutlookPanel recovery={recovery} />
    <SimilarReportsPanel similarity={similarity} />
    <SubmissionReminderPanel />
  </aside>
</div>
```

### What to remove
- The `DocumentActionCard` grid (4-card row with NCRP/Bank/Timeline/Checklist)
- The `DOCUMENT_TABS` and `DocumentActionCard` imports
- The `activeDocKind` state
- The `onClick` handler that called `scrollIntoView`

`DocumentWorkspace` handles tab switching internally via its own `TabsList`.

## DataPanel overflow: `overflow-hidden` + `break-words`

`DataPanel` wraps content in a `Card` with `h-full`. Content that exceeds the card
width (e.g. RecoveryOutlookPanel's long factor list, explanation text) overflows
unless the card clips it.

### Fix
```tsx
// DataPanel.tsx — add overflow-hidden to Card
<Card className={cn("h-full overflow-hidden", className)}>

// RecoveryOutlookPanel.tsx — add break-words to long text
<p className="text-sm text-muted-foreground break-words">{recovery.explanation}</p>
<ul className="flex flex-col gap-1.5 text-sm text-foreground break-words">
```

Without `overflow-hidden`, text spills out of the card edges. Without `break-words`,
long unbroken strings push past the container.
