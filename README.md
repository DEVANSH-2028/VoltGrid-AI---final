# VoltGrid AI

**A geopolitical- and tariff-resilient sourcing network for EV battery assembly.**

VoltGrid AI is a SAP Side-by-Side AI Extension concept for the LFP battery plant in Chakan, Pune. It extends SAP S/4HANA, SAP Ariba, SAP IBP, and SAP Build Process Automation; it is not an ERP replacement.

The prototype models an annual procurement network of approximately ₹180 Cr and an expanded catalogue of 43 suppliers. Its operating goals include 99.2% plant uptime, more than 50% domestic value addition (DVA), and reducing disruption response from 72 hours to minutes.

## Product experience

The app has one auto-selected persona, **Meera Nair** (EV Sourcing Planner · Chakan Plant, Pune), and eight modules:

1. **Executive Control Tower** — procurement, supplier, inventory, and disruption KPIs with a crisis-playbook demo.
2. **Digital Twin & Suppliers** — supplier network map, risk indicators, and supplier details.
3. **Disruption & Split-Order Lab** — scenario simulations, strategy comparisons, and document verification.
4. **AI Agent Operations** — operational status and agent activity.
5. **Risk & PLI Compliance** — risk and domestic-value insights, with optional AI explanations.
6. **Approval Center (HITL)** — human review of recommendations and purchase-order approvals.
7. **SAP Extension & Audit** — SAP connection status, synchronization controls, and audit records.
8. **Sustainability Intelligence** — illustrative emissions, supplier and source context.

## Quick start

From the project root:

```sh
npm ci
npm run prisma:generate
npm run db:migrate:deploy
npm run dev
```

The ignored root `.env.local` is loaded for local backend and Prisma commands. Keep `DATABASE_URL` set to Neon's pooled URL and `DATABASE_URL_UNPOOLED` set to its direct URL. The server uses the pooled URL; Prisma schema migrations and the one-time SQLite import use the direct URL. Never copy real credentials into an example file or commit `.env.local`.

- Local frontend: <http://localhost:5173> (Vite proxies API and Socket.IO to Express)
- Local backend: <http://localhost:4000>
- Production: Express serves both the API and built frontend under one origin.

Useful commands:

```sh
npm run build
npm test
```

### SQLite data migration

The configured Neon branch has already received the PostgreSQL schema and the existing SQLite records. The SQLite file remains unchanged as a local backup. Do not rerun the import against this populated branch; its guard will refuse duplicate import.

For a different, empty Neon branch, first verify `.env.local` points to that branch, then apply the PostgreSQL migration and use the guarded importer:

```sh
npm run db:migrate:deploy
npm run db:import:sqlite -- --confirm-empty-target
```

The importer previews SQLite row counts by default, refuses a non-empty target, copies records in foreign-key order inside a transaction, and never modifies the SQLite file. Do not run `npm run db:seed:demo` against data you want to keep; the demo seed deletes and recreates records.

### Deploy on Render

Create a Render Web Service from this repository and use the included `render.yaml` Blueprint, or set:

- **Build command:** `npm ci && npm run build`
- **Start command:** `npm start`
- **Health check path:** `/api/health`

Set `DATABASE_URL` to the Neon pooled URL and `DATABASE_URL_UNPOOLED` to the direct URL in Render's environment settings. `JWT_SECRET` is generated securely by the Blueprint. The frontend calls `/api` on the same origin; do not set a localhost `VITE_API_BASE` for production. Optional SAP/AI credentials belong only in Render's secret environment settings.

**Public-access warning:** the prototype automatically signs in as its seeded demo persona using a static demo credential in the frontend. Replace this with real authentication and rotate/remove demo credentials before using the public site with confidential data or operational actions.

The currently configured Neon branch is ready for the app. For future schema changes, run `npm run db:migrate:deploy` against the intended Neon branch before deploying the app. No Render deployment is performed by this project change.

Optional local AI:

```powershell
ollama pull qwen2.5:3b
```

The app uses its deterministic rule engine when Ollama or external providers are unavailable.

## SAP integrations

The backend provides a live-first extension gateway for S/4HANA, Ariba, IBP, and Build Process Automation. By default, `SAP_MODE="auto"` uses configured live connections and falls back to seeded local data when a connection is unavailable. Use the app's SAP Data Routing settings to select **Auto** or **Local Sandbox Only**.

To configure a live connection, add the relevant endpoint and token or API key to `backend\.env`. The variable names are documented in [`backend/.env.example`](./backend/.env.example). Keep credentials out of source control. SAP purchase-order writes are disabled by default; enabling them requires `SAP_ALLOW_LIVE_WRITE="true"` and the required SAP organizational mappings.

## AI explanations

The Risk & PLI Compliance module can request explanations from SAP Generative AI Hub through the backend. Configure `AICORE_SERVICE_KEY` and `SAP_GENAI_MODEL` in `backend\.env`; the service key must remain server-side and must not be committed. Set `LLM_PROVIDER="fallback"` to use rule-based answers instead.

## Technology

- Frontend: React, Vite, React Router, Recharts, Leaflet, and Lucide
- Backend: Node.js, Express, and Socket.IO
- Data: Prisma with Neon PostgreSQL in deployment; the existing SQLite file is a one-time migration source
- SAP AI: SAP AI SDK for orchestration

## Prototype notes

- Seeded supplier, plant, and operational data are for demonstration; they are not a live production source of truth.
- PLI and DVA figures are illustrative calculations, not legal or compliance advice.
- Sustainability values are estimates, not verified carbon accounting.
- External news and disruption signals should be independently verified before operational use.
