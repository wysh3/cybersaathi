# India map data — CyberSaathi

The bundled `india-states.json` is a TopoJSON file containing all 36 Indian
states and union territories, with district-level geometry in the same file
when needed.

**Source:** `udit-001/india-maps-data` on GitHub
https://github.com/udit-001/india-maps-data

**File vendored:** `topojson/india.json` (commit `ef25ebc`)

**License:** The original repository states the data is curated from publicly
available sources and the author holds no liability for misrepresentations.
CyberSaathi vendors this file for visualisation only; no geographic claim is
made about exact district boundaries, and CyberSaathi's heatmap uses its own
deterministic complaint seed data — not this geometry — for state and district
rollups.

No runtime network fetch is performed; the file is shipped as a static asset
under `apps/web/lib/maps/`.
