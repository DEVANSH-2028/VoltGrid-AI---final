import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { componentSeedRows, supplierCoordinates, supplierSeedRows } from '../src/integrations/sap/seedDefaults.js'

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

  const components = await Promise.all(componentSeedRows.map(([code, name, category, unitCost, co2PerUnit]) => prisma.component.create({ data: { code, name, category, unitCost, co2PerUnit } })))

  const suppliers = []
  for (let i=0;i<supplierSeedRows.length;i++) {
    const r=supplierSeedRows[i]
    suppliers.push(await prisma.supplier.create({ data:{ code:r[0], name:r[1], country:r[2], region:r[3], city:r[4], latitude:supplierCoordinates[i][0], longitude:supplierCoordinates[i][1], domestic:r[5], dvaEligible:r[6], qualityScore:r[7], reliability:r[8], capacity:r[9], leadTimeDays:r[10], tariffRate:r[11], riskScore:r[12], status:r[13] > 18 ? 'WARNING' : 'HEALTHY' } }))
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
    {name:'Hormuz AIS',kind:'MARITIME',status:'READY',freshness:'30-minute source interval'},
    {name:'World Bank',kind:'COUNTRY',status:'READY',freshness:'Annual publication'},
    {name:'SAP S/4HANA',kind:'ERP',status:'SIMULATED',freshness:'Local database'},
  ]})
  await prisma.auditLog.create({data:{action:'SEED_DATA_LOADED',entityType:'SYSTEM',actor:'SYSTEM',detailsJson:JSON.stringify({suppliers:14,components:6,plant:'Chakan'})}})
  console.log('VoltGrid seed data created.')
}

main().finally(()=>prisma.$disconnect())
