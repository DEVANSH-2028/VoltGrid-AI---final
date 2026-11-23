export const componentSeedRows = [
  ['LFP-CELL', 'LFP Prismatic Cells', 'Battery cells', 42, 74],
  ['CAM', 'Cathode Active Material', 'Active materials', 31, 52],
  ['SEP', 'Battery Separators', 'Components', 8, 18],
  ['ELY', 'Electrolyte', 'Chemicals', 12, 21],
  ['BMS', 'Battery Management System', 'Electronics', 18, 29],
  ['ALC', 'Aluminium Cell Casings', 'Structural', 6, 16],
]

export const supplierSeedRows = [
  ['SUP-IN-01','Tata Chemicals Battery Materials','India','Maharashtra','Pune',true,true,94,96,82,18,0,92,8.1],
  ['SUP-IN-02','Amara Raja Advanced Cells','India','Andhra Pradesh','Tirupati',true,true,96,94,70,21,0,88,12.4],
  ['SUP-IN-03','Exide LFP Systems','India','Tamil Nadu','Chennai',true,true,91,92,65,24,0,84,14.7],
  ['SUP-IN-04','Rajamane Hegde Technologies','India','Karnataka','Bengaluru',true,true,88,89,45,15,0,91,7.8],
  ['SUP-CN-01','CATL Supply India','China','Guangdong','Ningde',false,false,97,85,75,35,18,81,18.6],
  ['SUP-CN-02','EVE Energy Components','China','Zhejiang','Huizhou',false,false,95,83,68,38,18,77,21.2],
  ['SUP-CN-03','Gotion High-Tech','China','Anhui','Hefei',false,false,93,80,60,41,18,74,24.1],
  ['SUP-KR-01','LG Energy Material Korea','South Korea','Chungcheong','Daejeon',false,true,98,91,55,25,9,86,16.3],
  ['SUP-JP-01','Nippon Separator Works','Japan','Osaka','Osaka',false,true,99,95,50,28,7,89,13.2],
  ['SUP-DE-01','Varta Industrial Cells','Germany','Baden-Wurttemberg','Ellwangen',false,true,97,93,44,32,6,90,11.9],
  ['SUP-VN-01','VinES Battery Materials','Vietnam','Ninh Binh','Gia Vien',false,true,92,88,58,30,5,82,15.8],
  ['SUP-AE-01','Emirates Battery Alloy','UAE','Dubai','Jebel Ali',false,true,90,87,42,22,4,80,17.5],
  ['SUP-US-01','Novonix Materials US','United States','Nova Scotia','Bedford',false,true,96,90,40,36,8,85,19.4],
  ['SUP-AU-01','Novus Lithium Materials','Australia','Western Australia','Perth',false,true,94,86,48,29,3,83,12.7],
]

export const supplierCoordinates = [
  [18.52,73.86],[13.66,79.42],[13.08,80.27],[12.97,77.59],[26.96,119.3],[23.02,114.4],[31.82,117.0],
  [36.35,127.38],[34.69,135.5],[48.96,10.13],[20.35,105.96],[25.02,55.06],[44.73,-63.66],[-31.95,115.86],
]

export function getSeedFallbacks() {
  const plant = {
    id: 'seed-plant-chkn-01',
    code: 'CHKN-01',
    name: 'Chakan LFP Assembly Plant',
    city: 'Chakan, Pune',
    country: 'India',
    latitude: 18.7586,
    longitude: 73.8553,
    annualValue: 1800000000,
    uptimeTarget: 99.2,
    dvaTarget: 50,
  }
  const components = componentSeedRows.map(([code, name, category, unitCost, co2PerUnit]) => ({
    id: `seed-component-${code.toLowerCase()}`, code, name, category, unitCost, co2PerUnit,
  }))
  const suppliers = supplierSeedRows.map((row, index) => {
    const [code, name, country, region, city, domestic, dvaEligible, qualityScore, reliability, capacity, leadTimeDays, tariffRate, riskScore, statusScore] = row
    const [latitude, longitude] = supplierCoordinates[index]
    return {
      id: `seed-supplier-${code.toLowerCase()}`,
      code, name, country, region, city, latitude, longitude, domestic, dvaEligible,
      qualityScore, reliability, capacity, leadTimeDays, tariffRate, riskScore,
      status: statusScore > 18 ? 'WARNING' : 'HEALTHY',
    }
  })
  const inventory = components.map((component, index) => ({
    id: `seed-inventory-${component.code.toLowerCase()}`,
    plantId: plant.id,
    componentId: component.id,
    quantity: component.code === 'LFP-CELL' ? 18000 : 24000,
    reorderPoint: component.code === 'LFP-CELL' ? 8000 : 6000,
    plant,
    component,
  }))
  const purchaseOrders = Array.from({ length: 6 }, (_, index) => {
    const supplier = suppliers[index]
    const component = components[index]
    const quantity = 1200 * (index + 1)
    const unitCost = component.unitCost
    return {
      id: `seed-po-${index + 1}`,
      poNumber: `PO-2026-${String(index + 1).padStart(4, '0')}`,
      plantId: plant.id,
      supplierId: supplier.id,
      status: index === 5 ? 'AT_RISK' : 'OPEN',
      totalValue: 6200000 * (index + 1),
      approvalStatus: index === 5 ? 'PENDING' : 'NONE',
      erpSynced: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      plant,
      supplier,
      items: [{
        id: `seed-po-item-${index + 1}`,
        poId: `seed-po-${index + 1}`,
        componentId: component.id,
        supplierId: supplier.id,
        quantity,
        unitCost,
        component,
        supplier,
      }],
    }
  })
  for (const supplier of suppliers) {
    supplier.tariffExposure = supplier.tariffRate
    supplier.componentCategory = [...new Set(purchaseOrders
      .filter(order => order.supplierId === supplier.id)
      .flatMap(order => order.items.map(item => item.component.category)))].join(', ') || null
  }
  const createdAt = new Date('2026-01-01T00:00:00.000Z')
  const disruptions = [
    { id: 'seed-disruption-tariff', type: 'TARIFF', title: 'China LFP battery component tariff review', description: 'Illustrative tariff signal affecting imported prismatic cells.', country: 'China', severity: 'HIGH', source: 'GDELT signal', confirmed: false, createdAt },
    { id: 'seed-disruption-port', type: 'PORT', title: 'Mumbai port congestion', description: 'Simulated container dwell-time increase.', country: 'India', severity: 'MODERATE', source: 'Weather/logistics simulation', confirmed: true, createdAt },
  ]
  const externalDataSources = [
    { id: 'seed-source-frankfurter', name: 'Frankfurter', kind: 'CURRENCY', status: 'READY', freshness: 'On-demand cache', sourceUrl: null, lastSyncAt: null },
    { id: 'seed-source-gdelt', name: 'GDELT', kind: 'NEWS', status: 'READY', freshness: 'Simulated / 15 min cache', sourceUrl: null, lastSyncAt: null },
    { id: 'seed-source-weather', name: 'Open-Meteo', kind: 'WEATHER', status: 'READY', freshness: 'On-demand cache', sourceUrl: null, lastSyncAt: null },
    { id: 'seed-source-sap', name: 'SAP S/4HANA', kind: 'ERP', status: 'SIMULATED', freshness: 'Local database', sourceUrl: null, lastSyncAt: null },
  ]
  const auditLogs = [{
    id: 'seed-audit-data-loaded',
    action: 'SEED_DATA_LOADED',
    entityType: 'SYSTEM',
    actor: 'SYSTEM',
    detailsJson: JSON.stringify({ suppliers: 14, components: 6, plant: 'Chakan' }),
    createdAt,
  }]
  return {
    plant, plants: [plant], components, suppliers, inventory, bom: [], purchaseOrders, disruptions,
    incidents: [], approvals: [], auditLogs, externalDataSources, complianceAssessments: [], allocations: [],
  }
}
