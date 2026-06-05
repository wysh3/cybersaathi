# screenshots/v5 — F005 Premium App Redesign System

Desktop + mobile captures of all 12 routes after the F005 redesign
(Phase 1a–1i). All shots are full-page, taken headless on Chromium
via `tests/browser-smoke.ts` and `tests/e2e-golden-hour-bilingual.ts`.

| File | Route | Viewport |
|---|---|---|
| 01-intake-desktop / mobile | `/` | 1440×900 / 375×812 |
| 02-emergency-desktop / mobile | `/emergency` | 1440×900 / 375×812 |
| 03-documents-desktop / mobile | `/documents` | 1440×900 / 375×812 |
| 04-fall-back-desktop / mobile | `/fall-back` | 1440×900 / 375×812 |
| 05-dashboards-public-desktop / mobile | `/dashboards/public` | 1440×900 / 375×812 |
| 06-dashboards-heatmap-desktop | `/dashboards/heatmap` | 1440×900 |
| 07-dashboards-journalist-desktop | `/dashboards/journalist` | 1440×900 |
| 08-dashboards-police-desktop | `/dashboards/police` | 1440×900 |
| 09-accountability-desktop / mobile | `/accountability` | 1440×900 / 375×812 |
| 10-demo-desktop / mobile | `/demo` | 1440×900 / 375×812 |
| 11-emergency-active-golden-hour-desktop / mobile | `/emergency?caseId=...` | 1440×900 / 375×812 |

## How to regenerate

```bash
# 1. Start API (terminal 1) and Web (terminal 2) in production mode
cd apps/api && python run_api.py
cd apps/web && npx next start -p 3000

# 2. Capture all 17 static-route screenshots
cd apps/web && npx tsx tests/browser-smoke.ts

# 3. Capture the 2 active Golden Hour screenshots (needs an active case)
cd apps/web && npx tsx tests/e2e-golden-hour-bilingual.ts
```

The browser-smoke script writes to `screenshots/*.png` at the
monorepo root. Copy into `screenshots/v5/` to publish a new design
version.
