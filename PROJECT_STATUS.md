# VoltGrid AI — Project Status

**Last updated:** 2026-11-24

## VoltGrid AI 2.0 implementation snapshot

- Added a persistent eighth Sustainability Intelligence module and a compact enterprise data-source panel.
- Added live Frankfurter → open.er-api.com currency failover with five-minute caching, PostgreSQL snapshots, stale-data preservation, and explicit fallback states.
- Added USD/INR, EUR/INR, and CNY/INR display, a USD converter, 60-second UI refresh, Socket.IO FX updates, and captured FX provenance on simulations.
- Imported-supplier landed-cost estimates now use the captured exchange rate against an explicitly labelled ₹83.12 seed-price baseline, plus the scenario depreciation override.
- Added live Open-Meteo forecast retrieval and live GDELT headline retrieval with verification labels and caching.
- Added a local Ollama provider health check and optional enhancement fallback to the deterministic rule engine.
- Added experimental Hormuz adapter handling and five clearly labelled planning maritime routes.
- Expanded the seed catalogue to 43 suppliers across 10+ sourcing countries and 19 component/material categories.
- Added supplier and purchase-order CSV exports and retained SAP purchase-order writes disabled by default.
- Database changes are additive; the migrated SQLite source remains unchanged.

## Current product baseline

VoltGrid AI is a local prototype for a SAP Side-by-Side AI Extension supporting the Chakan LFP battery plant. The active application has eight consolidated modules and one active persona, Meera Nair. It extends SAP S/4HANA, Ariba, IBP, and SAP Build Process Automation; it is not an ERP replacement.

The seeded demo represents a ₹180 Cr annual procurement network with 43 supplier catalogue entries. Its business goals—99.2% uptime, more than 50% DVA, and disruption-response compression from 72 hours to minutes—are illustrative targets, not production measurements.

## Implementation status

| Area | Status | Current implementation |
|---|---|---|
| Workspace, styling, and local data | Implemented | React/Vite frontend, Express backend, Prisma/PostgreSQL schema, SAP Fiori-inspired theme, and seeded Chakan data. |
| Persona and navigation | Implemented for the prototype | App automatically opens as Meera Nair. Eight modules are active, including Sustainability Intelligence. No login screen or role switcher is exposed. |
| Database and deployment | Database migration complete; Render deploy pending | Prisma migrations target Neon PostgreSQL with pooled runtime and direct migration URLs. The existing SQLite dataset was imported into the previously empty configured Neon branch. Express serves frontend and API from one origin. |
| Control Tower | Implemented | Procurement and supplier KPIs, sourcing composition, risk/incident indicators, alerts, and crisis-playbook action. Some trend and demo values are illustrative. |
| Digital Twin & Suppliers | Implemented | Leaflet map, plant/supplier markers, supplier directory, and synchronized selection. Seeded coordinates and port information are illustrative. |
| Disruption and allocation workflow | Implemented for deterministic scenarios | Scenario controls, strategy comparison, persisted incident runs, and weighted supplier-allocation heuristic. This is not a production optimization solver. |
| VoltSense, VoltRoute, VoltGuard, and risk engine | Implemented for the prototype | Sequential backend services record findings, weighted risk breakdown, proposed allocations, DVA results, and incident history. These are deterministic services, not autonomous LLM agents. |
| HITL approvals | Implemented | Meera can approve, reject, or request revision. Local approval and audit records are persisted; SAP synchronization depends on configuration. |
| SAP Extension & Audit | Implemented with local fallback | SAP status, connection testing, routing mode, latest approval payload, audit log, CSV audit export, and a generic PDF summary. Live SAP use is optional and writes are disabled by default. |
| AI explanations | Implemented with provider configuration | Database-grounded deterministic fallback is available; SAP Generative AI Hub requires backend configuration and credentials. |
| FX data | Implemented with explicit fallback provenance | Frankfurter with open.er-api.com failover, in-memory and PostgreSQL caching, rate history, Socket.IO refresh, and saved rates/depreciation with each simulation. Seed-rate price calibration remains illustrative. |
| Sustainability, document intelligence, and external signals | Partial / illustrative | Sustainability module is active. Uploads do not perform reliable document text extraction. News and weather endpoints may be offline or stale. |
| Automated verification | Current checks pass | Frontend production build passes; 17 backend tests pass. FX endpoints and the Lab UI were verified in the browser. |

## Seed data and database safety

The retained SQLite source remains intact. Its 504 records across 24 Prisma models were copied to the previously empty Neon branch; row counts were checked after import.

**Preserve existing Neon data.** The versioned Prisma migration creates the PostgreSQL schema. The one-time SQLite importer reads `backend/prisma/dev.db` read-only and refuses to import if any VoltGrid model table already contains records. `npm run db:seed:demo` remains destructive and is only for a disposable database.

## Verification snapshot

- `npm run build`: passed on 2026-11-24 with PostgreSQL Prisma client generation.
  - Vite reports the existing generated JavaScript chunk-size warning (about 953 kB).
- `npm test`: 17 passed, 0 failed on 2026-11-24.
  - Coverage includes FX provider fallback/cache/snapshot behavior, FX-adjusted allocations, allocation optimization, risk calculation, SAP extension/fallback behavior, and SAP Generative AI Hub configuration.
  - SAP fallback-related log output during tests is expected; tests exercised fallback behavior and confirmed live writes remain disabled by default.
- `git diff --check`: passed for the documentation changes in this update.
- Production-server smoke test passed against Neon: static SPA and refresh route, database health, demo authentication, dashboard data, and API 404 handling.

## Known gaps and guardrails

- The previous 18-page concept is consolidated into eight active modules. Legacy URLs redirect; they are not separate feature areas.
- Procurement is available through backend endpoints and approval flows, not a standalone procurement module.
- Sustainability calculations are illustrative and are not verified carbon accounting.
- Uploaded PDF/CSV files are stored with basic metadata and a verification flag; reliable extraction and policy interpretation are not implemented.
- FX simulations normalize imported demo prices against a seed-rate baseline; supplier currency quotations are not verified.
- The v3 prompt's Gemini/Groq provider chain, agent streaming UI, comprehensive supplier model, and expanded PO/report workflows remain planned work.
- Neon schema and SQLite data migration are complete for the configured branch. The Render site has not been deployed.
- PDF reports are generic summaries; a complete set of detailed report types is not implemented.
- The simulation reset endpoint records a request but retains seeded ERP and incident state.
- Risk, DVA/PLI, supplier, port, currency-fallback, and carbon values must not be presented as verified operational or legal data.
- Never claim a live SAP connection unless the configured live request succeeds. Keep SAP and AI service credentials in backend environment configuration, never in source control.

## Next validation and development priorities

1. Keep the eight-module navigation and single-persona experience consistent across UI and documentation.
2. Resolve or intentionally document the Vite bundle-size warning; retain readable build output and error handling.
3. Add end-to-end/browser checks for all active modules, auto-login, scenario-to-approval workflow, and audit exports.
4. Implement Gemini/Groq/Ollama provider failover and schema-validated agent outputs.
5. Improve allocation constraints and validate results against business-approved scenarios before calling it production optimization.
6. Preserve the existing schema and demo data unless a reviewed, non-destructive data-change plan is explicitly approved.
