import { fetchInventory } from '../integrations/sap/sapExtensionGateway.js'

export async function runVoltGuard(optimization) {
  const inventoryResult = await fetchInventory()
  const dva = Number(optimization.dva || 0)
  const result = dva >= 52 ? 'SAFE' : dva >= 50 ? 'WARNING' : 'CRITICAL'
  return { dva, target:50, safeBuffer:52, result, procurementAllowed: dva >= 50, findings:[
    `Calculated DVA is ${dva.toFixed(1)}%.`,
    dva >= 52 ? 'Meets the demonstration safe buffer.' : dva >= 50 ? 'Within threshold but requires managerial review.' : 'Below threshold; procurement recommendation is blocked.'
  ], sapSource: inventoryResult.meta }
}
