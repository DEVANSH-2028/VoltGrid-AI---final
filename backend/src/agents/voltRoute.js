import { optimizeAllocation } from '../services/optimization.js'
import { fetchSuppliers } from '../integrations/sap/sapExtensionGateway.js'
import { getSuppliers as getLocalSuppliers } from '../integrations/sap/fallbackStore.js'
import { prisma } from '../db/prisma.js'

export async function runVoltRoute(params) {
  const supplierResult = await fetchSuppliers()
  const localSuppliers = await getLocalSuppliers(prisma)
  const localIds = new Set(localSuppliers.map(supplier => supplier.id))
  const matchedSuppliers = supplierResult.data.filter(supplier => localIds.has(supplier.id))
  const suppliers = matchedSuppliers.length ? matchedSuppliers : localSuppliers
  const demand = Number(params.demand || 1000)
  return {
    ...optimizeAllocation({ suppliers, demand, tariffIncrease:Number(params.tariffIncrease||0), strategy:params.strategy||'BALANCED', inventoryLevel:Number(params.inventoryLevel||100) }),
    sapSource: supplierResult.meta,
  }
}
