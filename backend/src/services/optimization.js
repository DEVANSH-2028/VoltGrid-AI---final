export function optimizeAllocation({ suppliers, demand, tariffIncrease = 0, strategy = 'BALANCED', inventoryLevel = 100 }) {
  const candidates = suppliers
    .filter(s => s.capacity > 0)
    .map(s => {
      const baseCost = 42 + (s.domestic ? 2 : 7)
      const tariff = s.country === 'China' ? tariffIncrease : 0
      const landedCost = baseCost * (1 + tariff / 100) + s.leadTimeDays * 0.12
      const qualityRisk = (100 - s.qualityScore) * 0.45
      const reliabilityRisk = (100 - s.reliability) * 0.40
      const delayRisk = s.leadTimeDays * 0.55
      const concentrationRisk = s.domestic ? 5 : 14
      const carbonRisk = s.domestic ? s.leadTimeDays * 0.08 : s.leadTimeDays * 0.18
      let score
      if (strategy === 'COST') score = landedCost * 0.60 + qualityRisk * 0.20 + delayRisk * 0.20
      else if (strategy === 'DOMESTIC') score = landedCost * 0.25 + concentrationRisk * 0.20 + (s.domestic ? -30 : 35) + carbonRisk * 0.15
      else if (strategy === 'LOW_RISK') score = qualityRisk + reliabilityRisk + delayRisk * 0.75 + (s.domestic ? 0 : 10)
      else score = landedCost * 0.34 + qualityRisk * 0.22 + reliabilityRisk * 0.18 + delayRisk * 0.16 + concentrationRisk * 0.10
      return { supplier: s, landedCost, score }
    })
    .sort((a, b) => a.score - b.score)
  const primary = candidates[0]
  const secondary = candidates.find(c =>
    c.supplier.id !== primary?.supplier.id &&
    c.supplier.capacity >= 35
  )
  const primaryShare = strategy === 'DOMESTIC' ? 0.75 : 0.65
  const allocation = []
  if (primary) allocation.push({
    supplierId: primary.supplier.id, supplierName: primary.supplier.name,
    quantity: Math.round(demand * primaryShare), unitCost: Number(primary.landedCost.toFixed(2)),
    landedCost: Number((demand * primaryShare * primary.landedCost).toFixed(2)),
    delayDays: primary.supplier.leadTimeDays,
    reason: `${primary.supplier.domestic ? 'Domestic eligibility' : 'Cost and capacity fit'}; primary ${strategy.toLowerCase()} allocation`
  })
  if (secondary) allocation.push({
    supplierId: secondary.supplier.id, supplierName: secondary.supplier.name,
    quantity: Math.round(demand * (1 - primaryShare)), unitCost: Number(secondary.landedCost.toFixed(2)),
    landedCost: Number((demand * (1 - primaryShare) * secondary.landedCost).toFixed(2)),
    delayDays: secondary.supplier.leadTimeDays,
    reason: 'Capacity diversification and concentration-risk reduction'
  })
  const domesticValue = allocation.filter(a => suppliers.find(s => s.id === a.supplierId)?.domestic).reduce((sum,a)=>sum+a.landedCost,0)
  const totalValue = allocation.reduce((sum,a)=>sum+a.landedCost,0)
  return { allocation, dva: totalValue ? domesticValue / totalValue * 100 : 0, totalValue, inventoryCoverage: inventoryLevel }
}
