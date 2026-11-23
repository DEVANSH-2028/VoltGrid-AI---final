function recordsFrom(payload) {
  if (Array.isArray(payload?.value)) return payload.value
  if (Array.isArray(payload?.d?.results)) return payload.d.results
  if (Array.isArray(payload?.d?.value)) return payload.d.value
  if (Array.isArray(payload)) return payload
  return null
}

function firstValue(record, ...keys) {
  for (const key of keys) {
    const value = record?.[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}

function numberValue(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function findByCode(records, codeKeys, canonicalRows) {
  const code = firstValue(records, ...codeKeys)
  return code == null ? undefined : canonicalRows.find(row => String(row.code) === String(code))
}

export function unwrapODataCollection(payload) {
  return recordsFrom(payload)
}

export function normalizeSuppliers(payload, localSuppliers = []) {
  const records = recordsFrom(payload)
  if (!records) return []
  return records.map(record => {
    const code = firstValue(record, 'Supplier', 'SupplierNumber', 'SupplierId', 'ID', 'code')
    const local = localSuppliers.find(item => String(item.code) === String(code)) || {}
    return {
      ...local,
      id: local.id || String(code || firstValue(record, 'id', 'BusinessPartner') || ''),
      code: code ?? local.code ?? '',
      name: firstValue(record, 'SupplierName', 'BusinessPartnerName', 'Name', 'name') ?? local.name ?? '',
      country: firstValue(record, 'Country', 'CountryCode', 'country') ?? local.country ?? '',
      region: firstValue(record, 'Region', 'region') ?? local.region ?? '',
      city: firstValue(record, 'CityName', 'City', 'city') ?? local.city ?? '',
      latitude: numberValue(firstValue(record, 'Latitude', 'latitude'), local.latitude ?? null),
      longitude: numberValue(firstValue(record, 'Longitude', 'longitude'), local.longitude ?? null),
      domestic: local.domestic ?? false,
      dvaEligible: local.dvaEligible ?? false,
      componentCategory: firstValue(record, 'ComponentCategory', 'componentCategory') ?? local.componentCategory
        ?? ([...new Set((local.purchaseOrders || []).flatMap(order => order.items?.map(item => item.component?.category) || []))].join(', ') || null),
      tariffExposure: local.tariffExposure ?? local.tariffRate ?? null,
      qualityScore: numberValue(firstValue(record, 'QualityScore', 'qualityScore'), local.qualityScore ?? 0),
      reliability: numberValue(firstValue(record, 'Reliability', 'reliability'), local.reliability ?? 0),
      capacity: numberValue(firstValue(record, 'Capacity', 'capacity'), local.capacity ?? 0),
      leadTimeDays: numberValue(firstValue(record, 'LeadTimeDays', 'leadTimeDays'), local.leadTimeDays ?? 0),
      tariffRate: numberValue(firstValue(record, 'TariffRate', 'tariffRate'), local.tariffRate ?? 0),
      riskScore: numberValue(firstValue(record, 'RiskScore', 'riskScore'), local.riskScore ?? 0),
      status: firstValue(record, 'Status', 'status') ?? local.status ?? 'HEALTHY',
    }
  }).filter(item => item.code)
}

export function normalizePurchaseOrders(payload, localOrders = [], localSuppliers = []) {
  const records = recordsFrom(payload)
  if (!records) return []
  return records.map(record => {
    const poNumber = firstValue(record, 'PurchaseOrder', 'PurchaseOrderNumber', 'poNumber')
    const local = localOrders.find(item => String(item.poNumber) === String(poNumber)) || {}
    const supplierCode = firstValue(record, 'Supplier', 'SupplierNumber')
    const supplier = local.supplier || localSuppliers.find(item => String(item.code) === String(supplierCode)) || {
      id: String(supplierCode || ''),
      code: String(supplierCode || ''),
      name: String(supplierCode || 'SAP supplier'),
      country: '',
    }
    const rawItems = record.to_PurchaseOrderItem?.value || record.to_PurchaseOrderItem?.results
    return {
      ...local,
      id: local.id || String(poNumber || firstValue(record, 'id') || ''),
      poNumber: poNumber ?? local.poNumber ?? '',
      supplierId: local.supplierId || supplier.id,
      status: firstValue(record, 'PurchaseOrderStatus', 'Status', 'status') ?? local.status ?? 'OPEN',
      totalValue: numberValue(firstValue(record, 'PurchaseOrderNetAmount', 'NetAmount', 'totalValue'), local.totalValue ?? 0),
      approvalStatus: local.approvalStatus ?? 'NONE',
      erpSynced: true,
      supplier,
      plant: local.plant,
      items: Array.isArray(rawItems) ? rawItems : (local.items || []),
    }
  }).filter(item => item.poNumber)
}

export function normalizeInventory(payload, localInventory = []) {
  const records = recordsFrom(payload)
  if (!records) return []
  return records.map(record => {
    const code = firstValue(record, 'Material', 'MaterialNumber', 'Component', 'componentCode')
    const local = findByCode(record, ['Material', 'MaterialNumber', 'Component', 'componentCode'], localInventory.map(item => item.component).filter(Boolean)) || {}
    const matched = localInventory.find(item => item.component?.code === (code ?? local.code)) || {}
    return {
      ...matched,
      quantity: numberValue(firstValue(record, 'MatlWrhsStkQtyInMatlBaseUnit', 'UnrestrictedUseStockQty', 'Quantity', 'quantity'), matched.quantity ?? 0),
      componentId: matched.componentId || local.id || String(code || ''),
      component: matched.component || local || {
        id: String(code || ''),
        code: String(code || 'SAP-MATERIAL'),
        name: String(firstValue(record, 'MaterialName', 'MaterialDescription') || code || 'SAP material'),
        category: String(firstValue(record, 'ComponentCategory', 'MaterialGroup') || 'Unmapped'),
      },
      plantId: matched.plantId || String(firstValue(record, 'Plant', 'PlantId') || ''),
      reorderPoint: matched.reorderPoint ?? 0,
    }
  }).filter(item => item.component?.code || item.componentId)
}

export function normalizeBOM(payload, localBoms = []) {
  const records = recordsFrom(payload)
  if (!records) return []
  return records.map(record => {
    const materialCode = firstValue(record, 'BillOfMaterialComponent', 'Material', 'Component', 'componentCode')
    const component = localBoms.find(item => item.component?.code === materialCode)?.component
    const local = localBoms.find(item => item.component?.code === materialCode) || {}
    return {
      ...local,
      id: local.id || String(firstValue(record, 'BillOfMaterial', 'BOM', 'id') || ''),
      plantId: local.plantId || String(firstValue(record, 'Plant', 'PlantId') || ''),
      componentId: local.componentId || component?.id || String(materialCode || ''),
      quantity: numberValue(firstValue(record, 'BillOfMaterialItemQuantity', 'ComponentQuantity', 'Quantity', 'quantity'), local.quantity ?? 0),
      component: component || local.component,
      plant: local.plant,
    }
  }).filter(item => item.id || item.componentId)
}

export function buildS4HanaPurchaseOrderPayload(approvalRecord, splitAllocations = []) {
  const groups = new Map()
  for (const allocation of splitAllocations) {
    const supplierCode = allocation.supplier?.code || allocation.supplierCode
    if (!supplierCode) continue
    if (!groups.has(supplierCode)) groups.set(supplierCode, { supplier: allocation.supplier || { code: supplierCode }, items: [] })
    groups.get(supplierCode).items.push(allocation)
  }

  const config = {
    companyCode: String(process.env.SAP_S4HANA_COMPANY_CODE || '').trim(),
    purchasingOrganization: String(process.env.SAP_S4HANA_PURCHASING_ORG || '').trim(),
    purchasingGroup: String(process.env.SAP_S4HANA_PURCHASING_GROUP || '').trim(),
    plantCode: String(process.env.SAP_S4HANA_PLANT || '').trim(),
    currency: String(process.env.SAP_S4HANA_CURRENCY || 'INR').trim(),
  }
  const incident = approvalRecord?.incident
  const plant = incident?.po?.plant
  const payloads = [...groups.entries()].map(([supplierCode, group]) => ({
    PurchaseOrderType: 'NB',
    ...(config.companyCode ? { CompanyCode: config.companyCode } : {}),
    ...(config.purchasingOrganization ? { PurchasingOrganization: config.purchasingOrganization } : {}),
    ...(config.purchasingGroup ? { PurchasingGroup: config.purchasingGroup } : {}),
    Supplier: supplierCode,
    DocumentCurrency: config.currency,
    to_PurchaseOrderItem: group.items.map((allocation, index) => ({
      PurchaseOrderItem: String((index + 1) * 10).padStart(5, '0'),
      Plant: config.plantCode || plant?.code || 'CHKN-01',
      Material: allocation.component?.code || allocation.componentCode || 'LFP-CELL',
      OrderQuantity: Number(allocation.quantity || 0),
      PurchaseOrderQuantityUnit: 'EA',
      NetPriceAmount: Number(allocation.unitCost || 0),
      DocumentCurrency: config.currency,
    })),
  }))

  return {
    entitySet: 'A_PurchaseOrder',
    approvalId: approvalRecord?.id || null,
    incidentId: incident?.incidentId || null,
    payloads,
  }
}
