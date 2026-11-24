# VoltGrid AI

**A geopolitical- and tariff-resilient sourcing network for EV battery assembly.**

VoltGrid AI is a SAP Side-by-Side AI Extension concept for the LFP battery plant in Chakan, Pune. It extends SAP S/4HANA, SAP Ariba, SAP IBP, and SAP Build Process Automation; it is not an ERP replacement.

The prototype models an annual procurement network of approximately ₹180 Cr and 14 suppliers. Its operating goals include 99.2% plant uptime, more than 50% domestic value addition (DVA), and reducing disruption response from 72 hours to minutes.

## Product experience

The app has one auto-selected persona, **Meera Nair** (EV Sourcing Planner · Chakan Plant, Pune), and seven modules:

1. **Executive Control Tower** — procurement, supplier, inventory, and disruption KPIs with a crisis-playbook demo.
2. **Digital Twin & Suppliers** — supplier network map, risk indicators, and supplier details.
3. **Disruption & Split-Order Lab** — scenario simulations, strategy comparisons, and document verification.
4. **AI Agent Operations** — operational status and agent activity.
5. **Risk & PLI Compliance** — risk and domestic-value insights, with optional AI explanations.
6. **Approval Center (HITL)** — human review of recommendations and purchase-order approvals.
7. **SAP Extension & Audit** — SAP connection status, synchronization controls, and audit records.

## Quick start

From the project root in PowerShell:

```powershell
Copy-Item backend\.env.example backend\.env
npm run setup
npm run dev
```

`npm run setup` installs the workspace dependencies, generates the Prisma client, and initializes and seeds the local database.

- Frontend: <http://localhost:5173>
- Backend: <http://localhost:4000>

Useful commands:

```powershell
npm run build
npm test
```

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
- Data: Prisma with SQLite for the local prototype
- SAP AI: SAP AI SDK for orchestration

## Prototype notes

- Seeded supplier, plant, and operational data are for demonstration; they are not a live production source of truth.
- PLI and DVA figures are illustrative calculations, not legal or compliance advice.
- Sustainability values are estimates, not verified carbon accounting.
- External news and disruption signals should be independently verified before operational use.
