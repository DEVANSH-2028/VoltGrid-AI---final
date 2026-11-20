 HEAD
# VoltGrid AI

VoltGrid AI is a local enterprise prototype for resilient EV battery supply-chain operations.

## Quick start

```powershell
copy .env.example backend\.env
npm install
npm run setup
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000
- Demo password: `VoltGrid!2026`

## Demo users

| Role | Email |
|---|---|
| Planner | planner@voltgrid.ai |
| Manager | manager@voltgrid.ai |
| Auditor | auditor@voltgrid.ai |

## Stack

React/Vite, Express/Socket.IO, Prisma/SQLite, Zod-ready backend modules, Recharts and Lucide.

## Important prototype boundaries

- SAP integrations are simulated adapters, not live connections.
- GDELT and external news are not treated as verified tariff notifications.
- PLI/DVA values are configurable demonstration calculations, not legal advice.
- Sustainability values are illustrative estimates, not verified carbon accounting.

# VoltGrid-Ai
 0058f271b7e5979f4d6c472588d5e13963722e5c
