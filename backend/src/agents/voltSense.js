import { fetchInventory, fetchSuppliers } from '../integrations/sap/sapExtensionGateway.js'

export async function runVoltSense(params) {
  const supplierResult = await fetchSuppliers()
  const inventoryResult = await fetchInventory()
  const suppliers = supplierResult.data
  const affected = suppliers.filter(s => params.countries?.includes(s.country) || s.country === 'China')
  const inventory = inventoryResult.data
  const components = [...new Map(inventory.map(item => [item.component?.id, item.component]).filter(([id]) => id)).values()]
  return {
    classification: params.type || 'TARIFF',
    affectedComponents: components.filter(c => c.code === 'LFP-CELL').map(c => c.code),
    affectedCountries: [...new Set(affected.map(s => s.country))],
    tariffChange: Number(params.tariffIncrease || 0),
    affectedSupplierIds: affected.map(s => s.id),
    inventory,
    riskAssessment: params.delayDays > 30 ? 'CRITICAL' : params.tariffIncrease >= 25 ? 'HIGH' : 'MODERATE',
    confidence: 0.96,
    sourceMetadata: { kind: 'USER_SIMULATION', verified: false, freshness: 'Current execution' },
    sapSources: { suppliers: supplierResult.meta, inventory: inventoryResult.meta },
  }
}
