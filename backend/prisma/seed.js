import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  await prisma.auditLog.deleteMany()
  await prisma.approval.deleteMany()
  await prisma.complianceAssessment.deleteMany()
  await prisma.supplierAllocation.deleteMany()
  await prisma.riskAssessment.deleteMany()
  await prisma.agentExecution.deleteMany()
  await prisma.incident.deleteMany()
  await prisma.purchaseOrderItem.deleteMany()
  await prisma.purchaseOrder.deleteMany()
  await prisma.inventory.deleteMany()
  await prisma.bOM.deleteMany()
  await prisma.sustainabilityRecord.deleteMany()
  await prisma.component.deleteMany()
  await prisma.supplier.deleteMany()
  await prisma.plant.deleteMany()
  await prisma.user.deleteMany()
  await prisma.externalDataSource.deleteMany()

  const password = await bcrypt.hash('VoltGrid!2026', 10)
  for (const [name, email, role] of [
    ['Meera Nair', 'planner@voltgrid.ai', 'PLANNER'],
    ['Arjun Rao', 'manager@voltgrid.ai', 'MANAGER'],
    ['Priya Shah', 'auditor@voltgrid.ai', 'AUDITOR'],
  ]) await prisma.user.create({ data: { name, email, password, role } })

  const plant = await prisma.plant.create({
    data: { code: 'CHKN-01', name: 'Chakan LFP Assembly Plant', city: 'Chakan, Pune', country: 'India', latitude: 18.7586, longitude: 73.8553, annualValue: 1800000000, uptimeTarget: 99.2, dvaTarget: 50 }
  })

  const components = await Promise.all([
    ['LFP-CELL', 'LFP Prismatic Cells', 'Battery cells', 42, 74],
    ['CAM', 'Cathode Active Material', 'Active materials', 31, 52],
    ['SEP', 'Battery Separators', 'Components', 8, 18],
    ['ELY', 'Electrolyte', 'Chemicals', 12, 21],
    ['BMS', 'Battery Management System', 'Electronics', 18, 29],
    ['ALC', 'Aluminium Cell Casings', 'Structural', 6, 16],
  ].map(([code, name, category, unitCost, co2PerUnit]) => prisma.component.create({ data: { code, name, category, unitCost, co2PerUnit } })))

  const supplierRows = [
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
  const coordinates = [[18.52,73.86],[13.66,79.42],[13.08,80.27],[12.97,77.59],[26.96,119.3],[23.02,114.4],[31.82,117.0],[36.35,127.38],[34.69,135.5],[48.96,10.13],[20.35,105.96],[25.02,55.06],[44.73,-63.66],[-31.95,115.86]]
  const suppliers = []
  for (let i=0;i<supplierRows.length;i++) {
    const r=supplierRows[i]
    suppliers.push(await prisma.supplier.create({ data:{ code:r[0], name:r[1], country:r[2], region:r[3], city:r[4], latitude:coordinates[i][0], longitude:coordinates[i][1], domestic:r[5], dvaEligible:r[6], qualityScore:r[7], reliability:r[8], capacity:r[9], leadTimeDays:r[10], tariffRate:r[11], riskScore:r[12], status:r[13] > 18 ? 'WARNING' : 'HEALTHY' } }))
  }

  for (const component of components) {
    await prisma.inventory.create({ data: { plantId: plant.id, componentId: component.id, quantity: component.code === 'LFP-CELL' ? 18000 : 24000, reorderPoint: component.code === 'LFP-CELL' ? 8000 : 6000 } })
  }

  for (let i=0;i<6;i++) {
    const supplier = suppliers[i % suppliers.length]
    const component = components[i % components.length]
    const po = await prisma.purchaseOrder.create({ data:{ poNumber:`PO-2026-${String(i+1).padStart(4,'0')}`, plantId:plant.id, supplierId:supplier.id, status:i===5?'AT_RISK':'OPEN', totalValue:6200000*(i+1), approvalStatus:i===5?'PENDING':'NONE', items:{create:{componentId:component.id,supplierId:supplier.id,quantity:1200*(i+1),unitCost:component.unitCost}} } })
  }

  await prisma.disruptionEvent.createMany({ data:[
    {type:'TARIFF',title:'China LFP battery component tariff review',description:'Illustrative tariff signal affecting imported prismatic cells.',country:'China',severity:'HIGH',source:'GDELT signal',confirmed:false},
    {type:'PORT',title:'Mumbai port congestion',description:'Simulated container dwell-time increase.',country:'India',severity:'MODERATE',source:'Weather/logistics simulation',confirmed:true},
  ]})
  await prisma.externalDataSource.createMany({ data:[
    {name:'Frankfurter',kind:'CURRENCY',status:'READY',freshness:'On-demand cache'},
    {name:'GDELT',kind:'NEWS',status:'READY',freshness:'Simulated / 15 min cache'},
    {name:'Open-Meteo',kind:'WEATHER',status:'READY',freshness:'On-demand cache'},
    {name:'SAP S/4HANA',kind:'ERP',status:'SIMULATED',freshness:'Local database'},
  ]})
  await prisma.auditLog.create({data:{action:'SEED_DATA_LOADED',entityType:'SYSTEM',actor:'SYSTEM',detailsJson:JSON.stringify({suppliers:14,components:6,plant:'Chakan'})}})
  console.log('VoltGrid seed data created.')
}

main().finally(()=>prisma.$disconnect())
