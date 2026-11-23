import { getSeedFallbacks } from './seedDefaults.js'

const staticFallbacks = getSeedFallbacks()

async function loadOrUseSeed(name, query) {
  try {
    const records = await query()
    if (Array.isArray(records) && records.length > 0) return structuredClone(records)
  } catch (error) {
    console.warn(`SAP fallback store: Prisma ${name} read failed; using seeded defaults (${error?.message || 'database error'}).`)
  }
  return structuredClone(staticFallbacks[name])
}

export function getSuppliers(prisma) {
  return loadOrUseSeed('suppliers', () => prisma.supplier.findMany({
    include: { purchaseOrders: { include: { items: { include: { component: true } } } } },
    orderBy: { riskScore: 'desc' },
  }))
}

export function getPurchaseOrders(prisma) {
  return loadOrUseSeed('purchaseOrders', () => prisma.purchaseOrder.findMany({
    include: { supplier: true, plant: true, items: { include: { component: true, supplier: true } } },
    orderBy: { createdAt: 'desc' },
  }))
}

export function getInventory(prisma) {
  return loadOrUseSeed('inventory', () => prisma.inventory.findMany({ include: { component: true, plant: true } }))
}

export function getBOM(prisma) {
  return loadOrUseSeed('bom', () => prisma.bOM.findMany({ include: { component: true, plant: true } }))
}

export function getPlant(prisma) {
  return prisma.plant.findFirst()
    .then(plant => plant || structuredClone(staticFallbacks.plant))
    .catch(error => {
      console.warn(`SAP fallback store: Prisma plant read failed; using seeded defaults (${error?.message || 'database error'}).`)
      return structuredClone(staticFallbacks.plant)
    })
}

export function getComponents(prisma) {
  return loadOrUseSeed('components', () => prisma.component.findMany())
}

export function getPlants(prisma) {
  return loadOrUseSeed('plants', () => prisma.plant.findMany())
}

export function getDisruptions(prisma) {
  return loadOrUseSeed('disruptions', () => prisma.disruptionEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }))
}

export function getIncidents(prisma, options = {}) {
  return loadOrUseSeed('incidents', () => prisma.incident.findMany(options))
}

export function getApprovals(prisma, options = {}) {
  return loadOrUseSeed('approvals', () => prisma.approval.findMany(options))
}

export function getAuditLogs(prisma, options = {}) {
  return loadOrUseSeed('auditLogs', () => prisma.auditLog.findMany(options)).then(logs => {
    const filters = options.where?.AND || []
    const incidentId = filters.find(filter => filter.incidentId)?.incidentId
    const action = filters.find(filter => filter.action?.contains)?.action.contains
    const filtered = logs.filter(log =>
      (!incidentId || log.incidentId === incidentId)
      && (!action || log.action.toLowerCase().includes(String(action).toLowerCase())),
    )
    return options.take ? filtered.slice(0, options.take) : filtered
  })
}

export function getExternalDataSources(prisma) {
  return loadOrUseSeed('externalDataSources', () => prisma.externalDataSource.findMany())
}

export function getComplianceAssessments(prisma, options = {}) {
  return loadOrUseSeed('complianceAssessments', () => prisma.complianceAssessment.findMany(options))
}

export function getSupplierAllocations(prisma, options = {}) {
  return loadOrUseSeed('allocations', () => prisma.supplierAllocation.findMany(options))
}
