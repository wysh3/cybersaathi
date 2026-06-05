---
name: cybersaathi-team-workflow
description: Coordinate CyberSaathi builders and coding agents through minimal markdown status tracking, feature branches, PR readiness, conflict avoidance, and team handoffs. Use when a team member says they are Akshay, Nandan, or Vishruth; asks what to work on; claims a task; starts a feature branch; updates team status; prepares a commit/PR/merge; or resolves workflow conflicts.
---

# CyberSaathi Team Workflow

Use this skill before any team-workflow or branch-management action. The goal
is to keep three builders and their coding agents moving without trampling the
same files.

## Required First Step

Always read `team/STATUS.md` before advising or coding. If the user is Vishruth
preparing a merge or sequencing branches, also read `team/MERGE-PLAN.md`.

Then identify:

- the builder: `Akshay`, `Nandan`, or `Vishruth`
- their active feature, if any
- the feature branch
- the files owned by that feature
- the `Blocked By` line, if any
- whether `main` is marked Green, Yellow, or Red
- the task packet's required checks

If the builder has no active feature, recommend the highest-priority `Ready`
feature assigned to them whose blocker is satisfied. If none is assigned,
recommend the highest-priority unowned `Ready` feature whose blocker is
satisfied.

If a feature says `Blocked By: F005 merge` or similar, do not claim it until
that condition is true. Tell the builder the exact blocker and the next
allowed task.

## Claiming Work

Every builder must claim exactly one feature before coding.

When implementation is allowed:

1. Update `team/STATUS.md`.
2. Set the builder row to `In Progress`.
3. Set the feature row and feature block to `In Progress`.
4. Confirm the exact branch name.
5. Tell the builder to commit the status claim before code changes.

Use the exact status and feature templates from
`references/status-format.md` when editing status.

Do not claim multiple features for one builder. If a builder finishes a task,
move it to `In Review`; after merge, mark it `Done` and the builder
`Available` before claiming the next task.

## Branch Rules

All work happens on feature branches. Never advise direct work on `main`.

Branch format:

```text
feat/<builder>/Fxxx-short-slug
fix/<builder>/Fxxx-short-slug
docs/<builder>/short-slug
test/<builder>/short-slug
```

Examples:

```text
feat/akshay/F001-citizen-flow-resume
feat/nandan/F002-postgres-persistence
feat/vishruth/F003-police-dashboard-alpha
```

Use the exact commands from `references/git-commands.md`.

## Conflict Avoidance

- One feature owns its listed files while it is `In Progress`.
- If a builder needs a file owned by another active feature, add a note under
  the feature block before editing.
- If a UI feature touches shared chrome (`apps/web/components/app/` or
  `apps/web/app/globals.css`), check whether F005/F013 is active first.
- If a backend feature touches DB runtime, check whether F006 is active first.
- Keep `team/STATUS.md` edits small.
- Project lead resolves status-board conflicts.


## Before PR Or Merge

Require the relevant checks. For full app changes, run:

```bash
cd apps/api && PYTHONPATH=apps/api:.. uv run pytest
cd ../web && npm run typecheck && npm run lint && npm run build
npx tsx tests/browser-smoke.ts
npx tsx tests/e2e-priya.ts
npx tsx tests/e2e-fall-back.ts
npx tsx tests/e2e-golden-hour-bilingual.ts
```

Status should move to `In Review` before PR and `Done` only after merge.

## Response Shape

When a builder asks what to do, answer with:

1. Current assignment.
2. Whether the blocker is satisfied.
3. Branch command block.
4. Files they own.
5. Tests they must run.
6. Status update needed.

Keep it short and operational.
