# VoltGrid AI — Project Status

**Last updated:** 2026-11-23

## VoltGrid AI 2.0 implementation snapshot

- Added a persistent eighth Sustainability Intelligence module and a compact enterprise data-source panel.
- Added live Frankfurter → open.er-api.com currency failover with five-minute caching, SQLite snapshots, stale-data preservation, and explicit fallback states.
- Added USD/INR, EUR/INR, and CNY/INR display, a USD converter, 60-second UI refresh, Socket.IO FX updates, and captured FX provenance on simulations.
- Imported-supplier landed-cost estimates now use the captured exchange rate against an explicitly labelled ₹83.12 seed-price baseline, plus the scenario depreciation override.
- Added live Open-Meteo forecast retrieval and live GDELT headline retrieval with verification labels and caching.
- Added a local Ollama provider health check and optional enhancement fallback to the deterministic rule engine.
- Added experimental Hormuz adapter handling and five clearly labelled planning maritime routes.
- Expanded the seed catalogue to 43 suppliers across 10+ sourcing countries and 19 component/material categories.
- Added supplier and purchase-order CSV exports and retained SAP purchase-order writes disabled by default.
- Database changes are additive; the existing SQLite database was backed up before the upgrade.

## Current product baseline

VoltGrid AI is a local prototype for a SAP Side-by-Side AI Extension supporting the Chakan LFP battery plant. The active application has eight consolidated modules and one active persona, Meera Nair. It extends SAP S/4HANA, Ariba, IBP, and SAP Build Process Automation; it is not an ERP replacement.

The seeded demo represents a ₹180 Cr annual procurement network with 43 supplier catalogue entries. Its business goals—99.2% uptime, more than 50% DVA, and disruption-response compression from 72 hours to minutes—are illustrative targets, not production measurements.

## Implementation status

| Area | Status | Current implementation |
|---|---|---|
| Workspace, styling, and local data | Implemented | React/Vite frontend, Express backend, Prisma/SQLite, SAP Fiori-inspired theme, and seeded Chakan data. |
| Persona and navigation | Implemented for the prototype | App automatically opens as Meera Nair. Eight modules are active, including Sustainability Intelligence. No login screen or role switcher is exposed. |
| Control Tower | Implemented | Procurement and supplier KPIs, sourcing composition, risk/incident indicators, alerts, and crisis-playbook action. Some trend and demo values are illustrative. |
| Digital Twin & Suppliers | Implemented | Leaflet map, plant/supplier markers, supplier directory, and synchronized selection. Seeded coordinates and port information are illustrative. |
| Disruption and allocation workflow | Implemented for deterministic scenarios | Scenario controls, strategy comparison, persisted incident runs, and weighted supplier-allocation heuristic. This is not a production optimization solver. |
| VoltSense, VoltRoute, VoltGuard, and risk engine | Implemented for the prototype | Sequential backend services record findings, weighted risk breakdown, proposed allocations, DVA results, and incident history. These are deterministic services, not autonomous LLM agents. |
| HITL approvals | Implemented | Meera can approve, reject, or request revision. Local approval and audit records are persisted; SAP synchronization depends on configuration. |
| SAP Extension & Audit | Implemented with local fallback | SAP status, connection testing, routing mode, latest approval payload, audit log, CSV audit export, and a generic PDF summary. Live SAP use is optional and writes are disabled by default. |
| AI explanations | Implemented with provider configuration | Database-grounded deterministic fallback is available; SAP Generative AI Hub requires backend configuration and credentials. |
| FX data | Implemented with explicit fallback provenance | Frankfurter with open.er-api.com failover, in-memory and SQLite caching, rate history, Socket.IO refresh, and saved rates/depreciation with each simulation. Seed-rate price calibration remains illustrative. |
| Sustainability, document intelligence, and external signals | Partial / illustrative | Sustainability module is active. Uploads do not perform reliable document text extraction. News and weather endpoints may be offline or stale. |
| Automated verification | Current checks pass | Frontend production build passes; 17 backend tests pass. FX endpoints and the Lab UI were verified in the browser. |

## Seed data and database safety

The original destructive seed creates one Chakan plant, 14 baseline suppliers, six components, inventory, six purchase orders, illustrative disruptions, and demo users. A separate additive catalogue script expands this with 43 suppliers and 19 components.

**Preserve `backend/prisma/schema.prisma` and existing seeded data. Do not drop tables, run destructive migrations, or reset a database containing data that must be kept.** `npm run setup` runs `prisma db push` and then `backend/prisma/seed.js`; the seed deletes and recreates several records. Use setup only with a new or intentionally disposable local database, and back up any data before schema or seed operations.

## Verification snapshot

- `npm run build`: passed on 2026-11-23 after the FX and Lab changes.
  - Vite emitted warnings that React Router's `use client` directives were ignored during bundling and that the generated JavaScript chunk exceeds 500 kB.
- `npm test`: 17 passed, 0 failed on 2026-11-23.
  - Coverage includes FX provider fallback/cache/snapshot behavior, FX-adjusted allocations, allocation optimization, risk calculation, SAP extension/fallback behavior, and SAP Generative AI Hub configuration.
  - SAP fallback-related log output during tests is expected; tests exercised fallback behavior and confirmed live writes remain disabled by default.
- `git diff --check`: passed for the documentation changes in this update.
- Frontend/backend live server check passed; the FX endpoint and Disruption Lab rates/converter were browser-verified.

## Known gaps and guardrails

- The previous 18-page concept is consolidated into eight active modules. Legacy URLs redirect; they are not separate feature areas.
- Procurement is available through backend endpoints and approval flows, not a standalone procurement module.
- Sustainability calculations are illustrative and are not verified carbon accounting.
- Uploaded PDF/CSV files are stored with basic metadata and a verification flag; reliable extraction and policy interpretation are not implemented.
- FX simulations normalize imported demo prices against a seed-rate baseline; supplier currency quotations are not verified.
- The v3 prompt's Gemini/Groq provider chain, agent streaming UI, comprehensive supplier model, and expanded PO/report workflows remain planned work.
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
