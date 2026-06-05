# CyberSaathi Team Status

Last Updated: 2026-06-06 02:55 IST
Main Branch Health: Green
Current Stable Demo: Yes

## Active Builders

| Builder | Current Branch | Current Feature | Status |
|---|---|---|---|
| Nandan | none | Heatmap, journalist, citizen awareness | Done |
| Akshay | none | Post-Report Response Workflows | Done |
| Vishruth | none | F015 LLM Intake | Done |

## Active Features

| ID | Owner | Status | Branch |
|---|---|---|---|
| AWARENESS | Nandan | Done | feat/nandan/heatmap-journalist-citizen-awareness |

### F015 LLM Intake Conversational Case Builder
Status: Done
Owner: Vishruth
Branch: feat/vishruth/F015-llm-intake-conversational-case-builder
Merged Into: main
Blocked By: none
Goal: Replace deterministic intake form with LLM-powered conversational case builder.
Notes:
- 2026-06-06 01:40 IST: Merged to main as F015 LLM Intake.

### Post-Report Response Workflows
Status: Done
Owner: Akshay
Branch: feat/akshay/post-report-workflows
Merged Into: main
Blocked By: none
Goal: Continue the LLM intake case flow into structured post-report response workflows.
Notes:
- 2026-06-06 02:05 IST: Merged to main after F015 integration.

### Heatmap, Journalist, Citizen Awareness
Status: Done
Owner: Nandan
Branch: feat/nandan/heatmap-journalist-citizen-awareness
Merged Into: main
Blocked By: none
Goal: Add citizen awareness and journalist/heatmap dashboard improvements while preserving the LLM intake and post-report flows.
Done When:
- ☑ Updated main merged without dropping F015 or post-report work.
- ☑ Dashboard/category data uses only canonical W1-W5 workflow categories.
- ☑ Backend and frontend checks pass.
Files Owned:
- apps/api/app/routers/map.py
- apps/web/app/dashboard/page.tsx
- apps/web/components/dashboard/**
- apps/web/components/dashboards/HeatmapPageClient.tsx
- apps/web/components/dashboards/LeafletIndiaHeatmap.tsx
- apps/web/public/india_state.geojson
Notes:
- 2026-06-06 02:25 IST: Merging updated main and enforcing canonical category output.
- 2026-06-06 02:55 IST: Merged into main locally after backend tests, web typecheck/lint/build, and browser smoke passed.
