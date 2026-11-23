 HEAD
# VoltGrid AI

VoltGrid AI is a local enterprise prototype for resilient EV battery supply-chain operations.

## Quick start

```powershell
copy backend\.env.example backend\.env
npm install
npm run setup
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000
- Demo password: `VoltGrid!2026`
- Set `VITE_API_BASE` in the workspace environment when the API is hosted at a different origin.

## SAP Generative AI Hub

The Risk & PLI Compliance page can request an explanation through the backend's `/api/assistant/query` endpoint. Set `LLM_PROVIDER="sap-genai-hub"` and `SAP_GENAI_MODEL` in `backend\.env`. Optionally set `SAP_GENAI_RESOURCE_GROUP` if your orchestration deployment is not in the default group. The backend uses SAP's official `@sap-ai-sdk/orchestration` package; credentials stay server-side.

For local development, create an SAP AI Core service key and put its complete JSON value in `AICORE_SERVICE_KEY` in `backend\.env` (as a single-line JSON string). On SAP BTP, bind an AI Core service instance instead. The service must have an active orchestration deployment and access to the configured model. Do not commit the service key. Missing credentials or an unavailable deployment are reported as API errors; the app does not silently pretend the LLM succeeded.

To use rule-based answers instead of SAP Generative AI Hub, set `LLM_PROVIDER="fallback"`.

## SAP Side-by-Side Extension Gateway

The backend exposes a live-first SAP gateway for S/4HANA, Ariba, IBP, and Build Process Automation. Set `SAP_MODE="auto"` and configure the required endpoint plus API key or bearer token to enable a system; unconfigured, timed-out, unauthorized, malformed, or unavailable responses use the seeded Chakan SQLite records and static seed defaults. Requests are aborted within `SAP_TIMEOUT_MS` (capped at 2500 ms). The in-memory routing setting can be changed between Auto and Local Sandbox Only from the header settings drawer or the authenticated `/api/sap/mode` endpoint.

Copy `backend\.env.example` to `backend\.env` and add credentials locally. S/4HANA can use the Business Accelerator Hub `APIKey` or `SAP_S4HANA_TOKEN`; if only the API Hub key is provided, the public S/4HANA Cloud sandbox URL is used. Ariba, IBP, and Build Process Automation use their configured base URL/webhook and bearer token. The Build webhook is not invoked by the connection-test button.

SAP purchase-order writes remain disabled unless `SAP_ALLOW_LIVE_WRITE="true"` and company code, purchasing organization, purchasing group, and plant mappings are configured. Every approval is first committed locally; SAP sync failures retain that local approval and record the generated `A_PurchaseOrder` payload and source in the Audit Log. Configure SAP master-data mappings before enabling writes; demo supplier and plant codes are not guaranteed to exist in a connected SAP tenant.

## Demo users

| Role | Email |
|---|---|
| Planner | planner@voltgrid.ai |
| Manager | manager@voltgrid.ai |
| Auditor | auditor@voltgrid.ai |

## Stack

React/Vite, Express/Socket.IO, Prisma/SQLite, Zod-ready backend modules, Recharts and Lucide.

## Important prototype boundaries

- SAP integrations use a live-first gateway with explicit local fallback; connections are only reported as live after a successful response.
- GDELT and external news are not treated as verified tariff notifications.
- PLI/DVA values are configurable demonstration calculations, not legal advice.
- Sustainability values are illustrative estimates, not verified carbon accounting.

# VoltGrid-Ai
 0058f271b7e5979f4d6c472588d5e13963722e5c
