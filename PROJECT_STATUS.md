# VoltGrid AI — Project Status

**Last updated:** 2026-11-23

## Current product baseline

VoltGrid AI is a local prototype for a SAP Side-by-Side AI Extension supporting the Chakan LFP battery plant. The active application has seven consolidated modules and one active persona, Meera Nair. It extends SAP S/4HANA, Ariba, IBP, and SAP Build Process Automation; it is not an ERP replacement.

The seeded demo represents a ₹180 Cr annual procurement network with 14 suppliers. Its business goals—99.2% uptime, more than 50% DVA, and disruption-response compression from 72 hours to minutes—are illustrative targets, not production measurements.

## Implementation status

| Area | Status | Current implementation |
|---|---|---|
| Workspace, styling, and local data | Implemented | React/Vite frontend, Express backend, Prisma/SQLite, SAP Fiori-inspired theme, and seeded Chakan data. |
| Persona and navigation | Implemented for the prototype | App automatically opens as Meera Nair. The seven active modules are Executive Control Tower; Digital Twin & Suppliers; Disruption & Split-Order Lab; AI Agent Operations; Risk & PLI Compliance; Approval Center (HITL); and SAP Extension & Audit. No login screen or role switcher is exposed. |
| Control Tower | Implemented | Procurement and supplier KPIs, sourcing composition, risk/incident indicators, alerts, and crisis-playbook action. Some trend and demo values are illustrative. |
| Digital Twin & Suppliers | Implemented | Leaflet map, plant/supplier markers, supplier directory, and synchronized selection. Seeded coordinates and port information are illustrative. |
| Disruption and allocation workflow | Implemented for deterministic scenarios | Scenario controls, strategy comparison, persisted incident runs, and weighted supplier-allocation heuristic. This is not a production optimization solver. |
| VoltSense, VoltRoute, VoltGuard, and risk engine | Implemented for the prototype | Sequential backend services record findings, weighted risk breakdown, proposed allocations, DVA results, and incident history. These are deterministic services, not autonomous LLM agents. |
| HITL approvals | Implemented | Meera can approve, reject, or request revision. Local approval and audit records are persisted; SAP synchronization depends on configuration. |
| SAP Extension & Audit | Implemented with local fallback | SAP status, connection testing, routing mode, latest approval payload, audit log, CSV audit export, and a generic PDF summary. Live SAP use is optional and writes are disabled by default. |
| AI explanations | Implemented with provider configuration | Database-grounded deterministic fallback is available; SAP Generative AI Hub requires backend configuration and credentials. |
| Sustainability, document intelligence, and external signals | Partial / illustrative | Sustainability endpoint and seeded records exist, but no dedicated active module. Uploads do not perform reliable document text extraction. News and weather endpoints return demo signals; currency lookup can use Frankfurter with fallback. |
| Automated verification | Current checks pass | Frontend production build passes; 12 backend tests pass. Full current browser/runtime verification has not been run as part of this status update. |

## Seed data and database safety

The seed creates one Chakan plant, 14 suppliers, six components, inventory, six purchase orders, illustrative disruptions, and demo users.

**Preserve `backend/prisma/schema.prisma` and existing seeded data. Do not drop tables, run destructive migrations, or reset a database containing data that must be kept.** `npm run setup` runs `prisma db push` and then `backend/prisma/seed.js`; the seed deletes and recreates several records. Use setup only with a new or intentionally disposable local database, and back up any data before schema or seed operations.

## Verification snapshot

- `npm run build`: passed on 2026-11-23.
  - Vite emitted warnings that React Router's `use client` directives were ignored during bundling and that the generated JavaScript chunk exceeds 500 kB.
- `npm test`: 12 passed, 0 failed on 2026-11-23.
  - Coverage includes allocation optimization, risk calculation, SAP extension/fallback behavior, and SAP Generative AI Hub configuration.
  - SAP fallback-related log output during tests is expected; tests exercised fallback behavior and confirmed live writes remain disabled by default.
- `git diff --check`: passed for the documentation changes in this update.
- Frontend/backend live server and browser-console verification: not run for this update.

## Known gaps and guardrails

- The previous 18-page concept is consolidated into seven active modules. Legacy URLs redirect; they are not separate feature areas.
- Procurement is available through backend endpoints and approval flows, not a standalone procurement module.
- Sustainability is illustrative and has no dedicated active module.
- Uploaded PDF/CSV files are stored with basic metadata and a verification flag; reliable extraction and policy interpretation are not implemented.
- News and weather endpoints are demo signals, not live GDELT/Open-Meteo ingestion.
- PDF reports are generic summaries; a complete set of detailed report types is not implemented.
- The simulation reset endpoint records a request but retains seeded ERP and incident state.
- Risk, DVA/PLI, supplier, port, currency-fallback, and carbon values must not be presented as verified operational or legal data.
- Never claim a live SAP connection unless the configured live request succeeds. Keep SAP and AI service credentials in backend environment configuration, never in source control.

## Next validation and development priorities

1. Keep the seven-module navigation and single-persona experience consistent across UI and documentation.
2. Resolve or intentionally document the Vite bundle-size warning; retain readable build output and error handling.
3. Add end-to-end/browser checks for the seven active modules, auto-login, scenario-to-approval workflow, and audit exports.
4. Implement real document extraction and verified external news/weather ingestion only with source attribution and user confirmation.
5. Improve allocation constraints and validate results against business-approved scenarios before calling it production optimization.
6. Add dedicated sustainability and report experiences only when their data methods and outputs are validated.
7. Preserve the existing schema and demo data unless a reviewed, non-destructive data-change plan is explicitly approved.
