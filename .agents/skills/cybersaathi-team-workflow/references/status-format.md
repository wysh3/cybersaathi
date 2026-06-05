# CyberSaathi Status Format

Use these exact status values:

```text
Ready
Backlog
In Progress
Blocked
In Review
Done
Available
```

## Builder Row

```md
| Builder | Current Branch | Current Feature | Status | Last Update |
|---|---|---|---|---|
| Akshay | feat/akshay/F001-citizen-flow-resume | F001 Citizen flow resume | In Progress | YYYY-MM-DD HH:mm IST |
```

## Feature Board Row

```md
| F001 | Citizen flow resume | Akshay | feat/akshay/F001-citizen-flow-resume | In Progress | P0 | main |
```

## Feature Block

```md
### F001 Citizen Flow Resume
Status: In Progress
Owner: Akshay
Branch: feat/akshay/F001-citizen-flow-resume
Blocked By: none
Goal: Make intake -> emergency -> documents survive refresh and direct navigation.
Done When:
- Golden Hour can reload by case id.
- Documents can reload by case id.
- Priya E2E passes.
- New refresh/direct-route E2E passes.
Files Owned:
- apps/web/lib/workflow-store.ts
- apps/web/components/emergency/EmergencyClient.tsx
- apps/web/components/documents/DocumentPackage.tsx
Notes:
- YYYY-MM-DD HH:mm IST: Claimed by Akshay.
```

Use `Blocked By: none` only when the feature can start immediately. Otherwise
write the exact blocker, for example:

```md
Blocked By: F005 merge.
```

## Blocking Note

```md
Notes:
- YYYY-MM-DD HH:mm IST: Blocked because <reason>. Needs <owner/action>.
```

## Handoff Note

```md
Notes:
- YYYY-MM-DD HH:mm IST: Ready for review. Summary: <what changed>. Tests: <commands/results>.
```
