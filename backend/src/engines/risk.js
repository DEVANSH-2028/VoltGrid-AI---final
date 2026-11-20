export function calculateRisk(input) {
  const tariffRisk = Math.min(100, (input.tariffIncrease || 0) * 1.8 + (input.affectedSuppliers?.length || 0) * 4)
  const stockoutRisk = Math.min(100, Math.max(0, (1 - (input.inventoryLevel || 100) / 100) * 100 + (input.delayDays || 0) * 2.2))
  const concentrationRisk = Math.min(100, (input.concentration || 55) * 0.85)
  const geopoliticalRisk = Math.min(100, (input.severity === 'CRITICAL' ? 92 : input.severity === 'HIGH' ? 74 : 48))
  const logisticsRisk = Math.min(100, (input.delayDays || 0) * 3.2 + 18)
  const dvaRisk = input.dva == null ? 35 : Math.max(0, Math.min(100, (50 - input.dva) * 8 + 25))
  const breakdown = {
    tariffExposure: { score: tariffRisk, weight: 25, contribution: tariffRisk * 0.25 },
    inventoryStockout: { score: stockoutRisk, weight: 25, contribution: stockoutRisk * 0.25 },
    supplierConcentration: { score: concentrationRisk, weight: 15, contribution: concentrationRisk * 0.15 },
    geopoliticalExposure: { score: geopoliticalRisk, weight: 15, contribution: geopoliticalRisk * 0.15 },
    logisticsDelay: { score: logisticsRisk, weight: 10, contribution: logisticsRisk * 0.10 },
    pliCompliance: { score: dvaRisk, weight: 10, contribution: dvaRisk * 0.10 },
  }
  const overallRisk = Object.values(breakdown).reduce((sum, item) => sum + item.contribution, 0)
  return {
    overallRisk: Math.round(overallRisk),
    tariffRisk: Math.round(tariffRisk),
    stockoutProbability: Math.round(stockoutRisk),
    concentrationRisk: Math.round(concentrationRisk),
    inventoryDepletion: Math.round(Math.max(0, (input.delayDays || 0) * 1.6)),
    geopoliticalRisk: Math.round(geopoliticalRisk),
    logisticsRisk: Math.round(logisticsRisk),
    dvaExposure: Math.round(dvaRisk),
    breakdown,
  }
}
