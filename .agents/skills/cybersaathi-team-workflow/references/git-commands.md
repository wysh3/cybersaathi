# CyberSaathi Git Commands

## Start A Feature

```bash
git checkout main
git pull origin main
git checkout -b feat/<builder>/Fxxx-short-slug
```

Example:

```bash
git checkout main
git pull origin main
git checkout -b feat/akshay/F001-citizen-flow-resume
```

## Claim Work

```bash
git add team/STATUS.md
git commit -m "docs(team): claim F001 citizen flow resume"
```

## Commit Work

Use small commits:

```bash
git add <files>
git commit -m "feat(flow): add case resume lookup"
git commit -m "test(flow): cover emergency refresh"
git commit -m "fix(ui): remove mobile overflow"
```

## Sync With Main

```bash
git fetch origin
git rebase origin/main
```

If rebase conflicts are only in `team/STATUS.md`, keep both useful updates and
preserve the latest `Last Updated` timestamp.

## Push Branch

```bash
git push -u origin feat/<builder>/Fxxx-short-slug
```

## PR Checklist

```text
- Backend tests pass, if backend touched.
- Frontend typecheck/lint/build pass, if frontend touched.
- Relevant E2E passes.
- Screenshots refreshed, if UI changed.
- No real official APIs called.
- Public dashboards stay anonymized.
```
