import './config/loadEnv.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import multer from 'multer'
import PDFDocument from 'pdfkit'
import { calculateRisk } from './engines/risk.js'
import { runVoltSense } from './agents/voltSense.js'
import { runVoltRoute } from './agents/voltRoute.js'
import { runVoltGuard } from './agents/voltGuard.js'
import { generateSapGenAiAnswer, SapGenAiConfigurationError } from './services/sapGenAiHub.js'
import { prisma } from './db/prisma.js'
import {
  getApprovals,
  getAuditLogs,
  getComponents,
  getComplianceAssessments,
  getDisruptions,
  getExternalDataSources,
  getIncidents,
  getPlant,
  getPlants,
  getSupplierAllocations,
  getSuppliers as getFallbackSuppliers,
} from './integrations/sap/fallbackStore.js'
import {
  fetchInventory,
  fetchPurchaseOrders,
  fetchSuppliers,
  getSapStatus,
  logHumanApprovalWorkflow,
  setSapMode,
  syncApprovedReallocation,
  testSapConnections,
} from './integrations/sap/sapExtensionGateway.js'
import { getNews, getWeather } from './services/dataAdapters.js'
import { getCurrencyRate, getFxLatest } from './services/fx.js'
import { getOllamaStatus, askOllama } from './services/localAi.js'

const app = express()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const frontendDistPath = path.resolve(__dirname, '../../frontend/dist')
const httpServer = createServer(app)
const io = new Server(httpServer, { cors:{ origin:'*' } })
const port = Number(process.env.PORT || 4000)
const upload = multer({ storage:multer.memoryStorage(), limits:{ fileSize:10*1024*1024 } })
const jwtSecret = process.env.JWT_SECRET || 'dev-secret'

if (process.env.NODE_ENV === 'production' && jwtSecret === 'dev-secret') {
  throw new Error('JWT_SECRET must be set to a private value in production.')
}

app.use(cors())
app.use(express.json({limit:'2mb'}))

function auth(req,res,next) {
  const token=req.headers.authorization?.replace(/^Bearer /,'')
  if(!token) return res.status(401).json({error:'Authentication required'})
  try { req.user=jwt.verify(token,jwtSecret); next() }
  catch { res.status(401).json({error:'Invalid session'}) }
}
function requireMeera(req,res,next) {
  if(req.user?.email !== 'planner@voltgrid.ai') return res.status(403).json({error:'This action is reserved for Meera Nair.'})
  next()
}

function emit(kind,payload) { io.emit('agent:event',{kind,payload,at:new Date().toISOString()}) }
function csvEscape(value) {
  const text=value==null?'':String(value)
  return `"${text.replace(/"/g,'""')}"`
}
async function audit(action,entityType,actor,details,incidentId) {
  await prisma.auditLog.create({data:{action,entityType,actor,detailsJson:JSON.stringify(details),incidentId}})
}

app.get('/api/health',async(req,res)=>{
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({status:'ok',database:'PostgreSQL'})
  } catch(error) {
    console.error('Database health check failed:',error?.code||'database error')
    res.status(503).json({status:'error',database:'unavailable'})
  }
})
app.get('/api/sap/status',auth,requireMeera,(req,res)=>res.json(getSapStatus()))
app.post('/api/sap/mode',auth,requireMeera,async(req,res)=>{
  const mode=String(req.body?.mode||'').trim().toLowerCase()
  if(!['auto','fallback'].includes(mode)) return res.status(400).json({error:'SAP mode must be "auto" or "fallback".'})
  const config=setSapMode(mode)
  let auditWarning=null
  try { await audit('SAP_MODE_CHANGED','SAP_EXTENSION','Meera Nair',{mode:config.mode},null) }
  catch(error) {
    auditWarning='Routing mode changed in memory, but the Audit Log could not be updated.'
    console.error('SAP mode change audit failed:',error?.message||'database error')
  }
  res.json({...getSapStatus(),auditWarning})
})
app.post('/api/sap/test-connection',auth,requireMeera,async(req,res)=>res.json(await testSapConnections()))
app.post('/api/auth/login',async(req,res)=>{
  const {email,password}=req.body
  const user=await prisma.user.findUnique({where:{email}})
  if(!user || !await bcrypt.compare(password||'',user.password)) return res.status(401).json({error:'Invalid demo credentials'})
  const token=jwt.sign({id:user.id,name:user.name,email:user.email,role:user.role},jwtSecret,{expiresIn:'12h'})
  res.json({token,user:{id:user.id,name:user.name,email:user.email,role:user.role}})
})
app.get('/api/auth/me',auth,(req,res)=>res.json({user:req.user}))

app.get('/api/dashboard',async(req,res)=>{
  const [supplierResult,components,plant,orderResult,disruptions,incidents,approvals,inventoryResult] = await Promise.all([
    fetchSuppliers(),getComponents(prisma),getPlant(prisma),fetchPurchaseOrders(),
    getDisruptions(prisma),getIncidents(prisma,{orderBy:{createdAt:'desc'},take:5}),
    getApprovals(prisma,{where:{status:'PENDING'},include:{incident:true},take:5}),fetchInventory()
  ])
  const suppliers=supplierResult.data
  const orders=orderResult.data
  const inventory=inventoryResult.data
  const spendByCountry={}
  suppliers.forEach(supplier=>{ if(supplier.country) spendByCountry[supplier.country]=spendByCountry[supplier.country]||0 })
  orders.forEach(o=>{const country=o.supplier.country||'Unknown';spendByCountry[country]=(spendByCountry[country]||0)+o.totalValue})
  const domestic=orders.filter(o=>o.supplier.domestic).reduce((s,o)=>s+o.totalValue,0)
  const total=orders.reduce((s,o)=>s+o.totalValue,0)
  const averageRisk=suppliers.reduce((s,x)=>s+x.riskScore,0)/Math.max(suppliers.length,1)
  const coverage=inventory.reduce((s,i)=>s+(i.quantity/i.reorderPoint)*10,0)/Math.max(inventory.length,1)
  res.json({
    kpis:{procurementValue:plant?.annualValue||1800000000,supplierCount:suppliers.length,overallRisk:Math.round(averageRisk),dva:58.4,inventoryCoverage:Math.round(Math.min(100,coverage)),atRiskPOs:orders.filter(o=>o.status==='AT_RISK').length,financialExposure:orders.filter(o=>o.status==='AT_RISK').reduce((s,o)=>s+o.totalValue,0),activeDisruptions:disruptions.filter(d=>d.confirmed).length,uptime:plant?.uptimeTarget||99.2,estimatedSavings:12800000},
    spendByCountry:Object.entries(spendByCountry).map(([country,value])=>({country,value})),
    riskDistribution:['HEALTHY','WARNING','CRITICAL'].map(name=>({name,count:suppliers.filter(s=>s.status===name).length||0})),
    sourcing:[{name:'Domestic',value:Math.round(total?domestic/total*100:58)},{name:'Imported',value:Math.round(total?(1-domestic/total)*100:42)}],
    inventoryCoverage:inventory.map(i=>({name:i.component.code,coverage:Math.round(Math.min(100,i.quantity/i.reorderPoint*100))})),
    dvaTrend:[{month:'Jan',dva:49.8},{month:'Feb',dva:51.2},{month:'Mar',dva:50.7},{month:'Apr',dva:53.1},{month:'May',dva:54.6},{month:'Jun',dva:58.4}],
    riskTrend:[{month:'Jan',risk:64},{month:'Feb',risk:61},{month:'Mar',risk:58},{month:'Apr',risk:55},{month:'May',risk:52},{month:'Jun',risk:Math.round(averageRisk)}],
    componentExposure:components.map(c=>({name:c.code,exposure:c.unitCost*8.4})),
    disruptions,incidents,approvals,orders:orders.slice(0,6),integrations:await getExternalDataSources(prisma),
    sapSources:{suppliers:supplierResult.meta,purchaseOrders:orderResult.meta,inventory:inventoryResult.meta}
  })
})

app.get('/api/suppliers',async(req,res)=>res.json((await fetchSuppliers()).data))
app.get('/api/suppliers/export/csv',async(req,res)=>{
  const suppliers=(await fetchSuppliers()).data
  const rows=suppliers.map(s=>[
    s.code,s.name,s.country,s.region,s.city,s.domestic?'Yes':'No',s.dvaEligible?'Yes':'No',
    s.qualityScore,s.reliability,s.capacity,s.leadTimeDays,s.tariffRate,s.riskScore,s.status,
  ].map(csvEscape).join(','))
  res.setHeader('Content-Type','text/csv; charset=utf-8')
  res.setHeader('Content-Disposition','attachment; filename="voltgrid_suppliers.csv"')
  res.send('Supplier ID,Supplier Name,Country,Region,City,Domestic,DVA Eligible,Quality %,Reliability %,Capacity,Lead Time Days,Tariff %,Risk Score,Status\n'+rows.join('\n'))
})
app.get('/api/suppliers/:id',async(req,res)=>{
  const supplier=(await fetchSuppliers()).data.find(item=>item.id===req.params.id||item.code===req.params.id)
  if(!supplier) return res.status(404).json({error:'Supplier not found'})
  res.json(supplier)
})
app.get('/api/inventory',async(req,res)=>res.json((await fetchInventory()).data))
app.get('/api/components',async(req,res)=>res.json(await getComponents(prisma)))
app.get('/api/plants',async(req,res)=>res.json(await getPlants(prisma)))

app.get('/api/procurement/orders',async(req,res)=>res.json((await fetchPurchaseOrders()).data))
app.get('/api/procurement/orders/export/csv',async(req,res)=>{
  const orders=(await fetchPurchaseOrders()).data
  const rows=orders.map(o=>[
    o.poNumber,o.status,o.approvalStatus,o.supplier?.name,o.supplier?.country,o.totalValue,o.createdAt,o.updatedAt,o.erpSynced?'Yes':'No',
  ].map(csvEscape).join(','))
  res.setHeader('Content-Type','text/csv; charset=utf-8')
  res.setHeader('Content-Disposition','attachment; filename="voltgrid_purchase_orders.csv"')
  res.send('PO Number,Status,Approval Status,Supplier,Country,INR Total,Order Date,Updated Date,SAP Synced\n'+rows.join('\n'))
})
app.post('/api/procurement/orders',auth,async(req,res)=>{
  const {supplierId,componentId,quantity,unitCost,status}=req.body
  const plant=await prisma.plant.findFirst()
  const po=await prisma.purchaseOrder.create({data:{poNumber:`PO-${Date.now()}`,plantId:plant.id,supplierId,status:status||'OPEN',totalValue:Number(quantity)*Number(unitCost),items:{create:{componentId,supplierId,quantity:Number(quantity),unitCost:Number(unitCost)}}}})
  await audit('PO_CREATED','PURCHASE_ORDER',req.user.email,{poNumber:po.poNumber,totalValue:po.totalValue},null)
  res.status(201).json(await prisma.purchaseOrder.findUnique({where:{id:po.id},include:{supplier:true,items:{include:{component:true}}}}))
})
app.patch('/api/procurement/orders/:id',auth,async(req,res)=>{
  const before=await prisma.purchaseOrder.findUnique({where:{id:req.params.id}})
  const po=await prisma.purchaseOrder.update({where:{id:req.params.id},data:req.body})
  await audit('PO_UPDATED','PURCHASE_ORDER',req.user.email,{before:{status:before.status,totalValue:before.totalValue},after:{status:po.status,totalValue:po.totalValue}},null)
  res.json(po)
})
app.post('/api/procurement/orders/:id/cancel',auth,async(req,res)=>{
  const po=await prisma.purchaseOrder.update({where:{id:req.params.id},data:{status:'CANCELLED'}})
  await audit('PO_CANCELLED','PURCHASE_ORDER',req.user.email,{poNumber:po.poNumber},null)
  res.json(po)
})

app.get('/api/incidents',async(req,res)=>res.json(await getIncidents(prisma,{include:{agentExecutions:true,riskAssessments:true,approvals:true,allocations:true,complianceAssessments:true},orderBy:{createdAt:'desc'}})))
app.post('/api/incidents/:id/run',async(req,res)=>{
  const incident=await prisma.incident.findUnique({where:{id:req.params.id}})
  if(!incident) return res.status(404).json({error:'Incident not found'})
  res.json(await executeIncident(incident))
})

async function executeIncident(incident) {
  const start=Date.now()
  emit('ORCHESTRATION_STARTED',{incidentId:incident.incidentId,status:'VoltSense'})
  await prisma.incident.update({where:{id:incident.id},data:{status:'RUNNING'}})
  const sense=await runVoltSense({type:incident.type,countries:['China'],tariffIncrease:incident.tariffIncrease,delayDays:incident.delayDays})
  await prisma.agentExecution.create({data:{incidentId:incident.id,agentName:'VOLTSENSE',status:'COMPLETE',inputJson:JSON.stringify({tariffIncrease:incident.tariffIncrease,delayDays:incident.delayDays}),outputJson:JSON.stringify(sense),confidence:sense.confidence,durationMs:Date.now()-start}})
  emit('VOLTSENSE_COMPLETE',{incidentId:incident.incidentId,findings:sense})

  const risk=calculateRisk({tariffIncrease:incident.tariffIncrease,inventoryLevel:incident.inventoryLevel,delayDays:incident.delayDays,affectedSuppliers:sense.affectedSupplierIds,severity:incident.type==='COMBINED'?'CRITICAL':'HIGH',concentration:65,dva:58.4})
  const financialExposure=sense.affectedSupplierIds.length*7800000
  const ra=await prisma.riskAssessment.create({data:{incidentId:incident.id,overallRisk:risk.overallRisk,tariffRisk:risk.tariffRisk,stockoutProbability:risk.stockoutProbability,concentrationRisk:risk.concentrationRisk,financialExposure,downtimeHours:incident.delayDays*1.8,dvaExposure:risk.dvaExposure,breakdownJson:JSON.stringify(risk.breakdown),explanation:`Weighted risk is ${risk.overallRisk}/100. The tariff and inventory factors contribute most strongly to the disruption exposure.`}})
  emit('RISK_COMPLETE',{incidentId:incident.incidentId,risk})

  const routeStart=Date.now()
  const route=await runVoltRoute({
    demand:incident.demand,
    tariffIncrease:incident.tariffIncrease,
    currencyDepreciation:incident.currencyDepreciation,
    fxRate:incident.fxRate,
    fxSource:incident.fxSource,
    inventoryLevel:incident.inventoryLevel,
    strategy:'BALANCED',
  })
  await prisma.agentExecution.create({data:{incidentId:incident.id,agentName:'VOLTROUTE',status:'COMPLETE',inputJson:JSON.stringify({demand:incident.demand,tariffIncrease:incident.tariffIncrease}),outputJson:JSON.stringify(route),confidence:0.94,durationMs:Date.now()-routeStart}})
  emit('VOLTROUTE_COMPLETE',{incidentId:incident.incidentId,allocation:route.allocation})

  await prisma.supplierAllocation.deleteMany({where:{incidentId:incident.id}})
  for(const item of route.allocation){
    await prisma.supplierAllocation.create({data:{incidentId:incident.id,supplierId:item.supplierId,componentId:(await prisma.component.findFirst({where:{code:'LFP-CELL'}})).id,quantity:item.quantity,unitCost:item.unitCost,landedCost:item.landedCost,delayDays:item.delayDays,reason:item.reason}})
  }

  const guard=await runVoltGuard(route)
  await prisma.agentExecution.create({data:{incidentId:incident.id,agentName:'VOLTGUARD',status:'COMPLETE',inputJson:JSON.stringify({dva:route.dva}),outputJson:JSON.stringify(guard),confidence:0.98,durationMs:42}})
  await prisma.complianceAssessment.create({data:{incidentId:incident.id,dva:guard.dva,target:50,result:guard.result,detailsJson:JSON.stringify(guard)}})
  emit('VOLTGUARD_COMPLETE',{incidentId:incident.incidentId,compliance:guard})

  const severeCommercialShock =
    incident.type==='COMBINED' ||
    incident.tariffIncrease>=30 ||
    incident.delayDays>=14 ||
    route.totalValue>500000
  const requiresHuman =
    severeCommercialShock ||
    guard.result==='WARNING' ||
    guard.result==='CRITICAL' ||
    risk.overallRisk>=70
  const approval=await prisma.approval.create({data:{incidentId:incident.id,status:requiresHuman?'PENDING':'APPROVED',financialImpact:route.totalValue,proposedJson:JSON.stringify(route),decisionNote:requiresHuman?'Human governance review required':'Autonomous execution zone'}})
  if(!requiresHuman) await prisma.incident.update({where:{id:incident.id},data:{status:'APPROVED'}})
  else await prisma.incident.update({where:{id:incident.id},data:{status:'AWAITING_APPROVAL'}})
  await audit('ORCHESTRATION_COMPLETED','INCIDENT', 'SYSTEM',{risk:risk.overallRisk,compliance:guard.result,approval:approval.status},incident.id)
  emit('ORCHESTRATION_COMPLETE',{incidentId:incident.incidentId,status:requiresHuman?'AWAITING_APPROVAL':'APPROVED'})
  return prisma.incident.findUnique({where:{id:incident.id},include:{agentExecutions:true,riskAssessments:true,allocations:{include:{supplier:true}},complianceAssessments:true,approvals:true}})
}

app.post('/api/simulator/trigger',auth,async(req,res)=>{
  const p=req.body
  const fxRate=Number(p.fxRate)
  const validFxRate=Number.isFinite(fxRate)&&fxRate>0?fxRate:null
  const requestedDepreciation=Number(p.currencyDepreciation||0)
  const currencyDepreciation=Number.isFinite(requestedDepreciation)?Math.max(0,Math.min(500,requestedDepreciation)):0
  const requestedFxDate=p.fxRetrievedAt?new Date(p.fxRetrievedAt):null
  const fxRetrievedAt=requestedFxDate&&Number.isFinite(requestedFxDate.getTime())?requestedFxDate:null
  const disruption=await prisma.disruptionEvent.create({data:{type:p.type||'TARIFF',title:p.title||'Custom disruption scenario',description:p.description||'User-configured local disruption simulation',country:p.country||'China',severity:p.tariffIncrease>=35?'CRITICAL':'HIGH',source:'Live disruption simulator',confirmed:false}})
  const incident=await prisma.incident.create({data:{incidentId:`INC-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(Date.now()).slice(-5)}`,title:p.title||'China tariff shock',status:'CREATED',type:p.type||'TARIFF',tariffIncrease:Number(p.tariffIncrease||35),delayDays:Number(p.delayDays||14),currencyDepreciation,fxRate:validFxRate,fxSource:validFxRate?String(p.fxSource||'Unknown'):null,fxSourceDate:p.fxSourceDate?String(p.fxSourceDate):null,fxRetrievedAt, supplierCapacityReduction:Number(p.supplierCapacityReduction||0),inventoryLevel:Number(p.inventoryLevel||100),demand:Number(p.demand||1000),disruptionEventId:disruption.id}})
  await audit('INCIDENT_CREATED','INCIDENT',req.user.email,{type:incident.type,tariffIncrease:incident.tariffIncrease,fxRate:incident.fxRate,fxSource:incident.fxSource,currencyDepreciation:incident.currencyDepreciation},incident.id)
  res.status(201).json(await executeIncident(incident))
})
app.post('/api/simulator/reset',auth,async(req,res)=>{
  await audit('SIMULATION_RESET','SYSTEM',req.user.email,{message:'Simulation state reset requested'},null)
  res.json({status:'RESET',message:'Seed ERP and incident state retained; create a new scenario to run from baseline'})
})

app.get('/api/approvals',async(req,res)=>res.json(await getApprovals(prisma,{include:{incident:{include:{riskAssessments:true,complianceAssessments:true,allocations:{include:{supplier:true}}}}},orderBy:{createdAt:'desc'}})))
app.post('/api/approvals/:id/:action',auth,requireMeera,async(req,res)=>{
  if(!['approve','reject','revise'].includes(req.params.action)) return res.status(400).json({error:'Invalid action'})
  const approval=await prisma.approval.findUnique({
    where:{id:req.params.id},
    include:{incident:{include:{po:{include:{plant:true}},allocations:{include:{supplier:true}}}}},
  })
  if(!approval) return res.status(404).json({error:'Approval not found'})
  if(approval.status!=='PENDING') return res.status(409).json({error:'This escalation has already been decided.'})
  const actor='Meera Nair'
  if(req.params.action==='approve') {
    const allocations=approval.incident.allocations||[]
    if(!allocations.length) return res.status(409).json({error:'This escalation has no split allocations to approve.'})
    const sync=await syncApprovedReallocation({
      approvalRecord:approval,
      splitAllocations:allocations,
      persistLocally:odataPayload=>prisma.$transaction(async tx=>{
        const updatedApproval=await tx.approval.update({where:{id:approval.id},data:{status:'APPROVED',approverId:req.user.id,decisionNote:req.body.note||'Approved through human governance'}})
        await tx.incident.update({where:{id:approval.incidentId},data:{status:'APPROVED'}})
        const bySupplier=new Map()
        for(const allocation of allocations) {
          const supplier=allocation.supplier
          if(!bySupplier.has(supplier.id)) bySupplier.set(supplier.id,{supplier,allocations:[]})
          bySupplier.get(supplier.id).allocations.push(allocation)
        }
        const plant=approval.incident.po?.plant||await tx.plant.findFirst()
        if(!plant) throw new Error('Chakan plant master data is unavailable; approval was not persisted.')
        const purchaseOrders=[]
        for(const {supplier,allocations:supplierAllocations} of bySupplier.values()) {
          const totalValue=supplierAllocations.reduce((sum,item)=>sum+Number(item.landedCost),0)
          const suffix=String(Date.now()).slice(-8)
          const lfpComponent=await tx.component.findFirst({where:{code:'LFP-CELL'}})
          if(!lfpComponent) throw new Error('LFP-CELL component master data is unavailable; approval was not persisted.')
          const order=await tx.purchaseOrder.create({
            data:{
              poNumber:`ERP-${suffix}-${supplier.code}`,
              plantId:plant.id,
              supplierId:supplier.id,
              status:'APPROVED',
              totalValue,
              approvalStatus:'APPROVED',
              erpSynced:false,
              items:{create:supplierAllocations.map(item=>({
                componentId:item.componentId||lfpComponent.id,
                supplierId:supplier.id,
                quantity:Number(item.quantity),
                unitCost:Number(item.unitCost),
              }))},
            },
          })
          purchaseOrders.push(order)
        }
        return {approval:updatedApproval,purchaseOrderIds:purchaseOrders.map(order=>order.id),payload:odataPayload}
      }),
      markLocallySynced:localResult=>prisma.purchaseOrder.updateMany({
        where:{id:{in:localResult.purchaseOrderIds}},
        data:{erpSynced:true},
      }),
    })
    const afterValue=allocations.reduce((sum,item)=>sum+Number(item.landedCost),0)
    const varianceINR=afterValue-Number(approval.incident.po?.totalValue||0)
    const workflow=await logHumanApprovalWorkflow({incidentId:approval.incident.incidentId,approver:actor,decision:'APPROVE',varianceINR})
    await audit('APPROVAL_APPROVE','APPROVAL',actor,{
      approvalId:approval.id,
      note:req.body.note,
      sapSyncSource:sync.meta.source,
      sapPayload:sync.payload,
      sapFallbackReason:sync.meta.fallbackReason||null,
    },approval.incidentId)
    const updated=await prisma.approval.findUnique({where:{id:approval.id},include:{incident:true}})
    return res.json({...updated,sapSyncSource:sync.meta.source,sapPayload:sync.payload,sapMeta:sync.meta,workflowMeta:workflow.meta})
  } else {
    await prisma.approval.update({where:{id:approval.id},data:{status:req.params.action==='reject'?'REJECTED':'REVISION_REQUESTED',approverId:req.user.id,decisionNote:req.body.note||req.params.action}})
    await prisma.incident.update({where:{id:approval.incidentId},data:{status:req.params.action==='reject'?'REJECTED':'REVISION_REQUESTED'}})
    const decision=req.params.action==='reject'?'REJECT':'REQUEST_REVISION'
    const workflow=await logHumanApprovalWorkflow({incidentId:approval.incident.incidentId,approver:actor,decision,varianceINR:0})
    await audit(`APPROVAL_${req.params.action.toUpperCase()}`,'APPROVAL',actor,{approvalId:approval.id,note:req.body.note,sapSyncSource:'NOT_APPLICABLE'},approval.incidentId)
    const updated=await prisma.approval.findUnique({where:{id:approval.id},include:{incident:true}})
    return res.json({...updated,workflowMeta:workflow.meta})
  }
})

app.get('/api/compliance',async(req,res)=>{
  const assessments=await getComplianceAssessments(prisma,{include:{incident:true},orderBy:{createdAt:'desc'},take:20})
  const suppliers=(await getFallbackSuppliers(prisma)).filter(supplier=>supplier.dvaEligible)
  res.json({target:50,safeBuffer:52,currentDva:assessments[0]?.dva||58.4,assessments,suppliers})
})
app.get('/api/audit',async(req,res)=>{
  const {incidentId,action,q}=req.query
  const logs=await getAuditLogs(prisma,{where:{AND:[incidentId?{incidentId:String(incidentId)}:{},action?{action:{contains:String(action),mode:'insensitive'}}:{}]},orderBy:{createdAt:'desc'},take:500})
  res.json(logs)
})
app.get('/api/audit/export',async(req,res)=>{
  res.setHeader('Content-Type','text/csv')
  res.setHeader('Content-Disposition','attachment; filename="voltgrid-audit.csv"')
  const logs=await getAuditLogs(prisma,{orderBy:{createdAt:'desc'}})
  res.send('timestamp,action,entityType,actor,details\n'+logs.map(l=>`"${l.createdAt.toISOString()}","${l.action}","${l.entityType}","${l.actor}","${l.detailsJson.replace(/"/g,'""')}"`).join('\n'))
})

app.post('/api/documents/upload',upload.single('document'),async(req,res)=>{
  if(!req.file) return res.status(400).json({error:'Document is required'})
  const extractedText=req.file.mimetype==='application/pdf'?'PDF text extraction is ready for verification; policy text requires manual confirmation.':'Document received. Text extraction supports uploaded policy documents.'
  const doc=await prisma.uploadedDocument.create({data:{fileName:req.file.originalname,mimeType:req.file.mimetype,extractedText}})
  res.status(201).json(doc)
})
app.post('/api/documents/:id/verify',auth,async(req,res)=>res.json(await prisma.uploadedDocument.update({where:{id:req.params.id},data:{verified:true}})))

app.get('/api/twin',async(req,res)=>res.json({plant:await getPlant(prisma),suppliers:(await fetchSuppliers()).data,ports:[{name:'Nhava Sheva',city:'Mumbai',latitude:18.95,longitude:72.95,status:'WARNING'},{name:'Mundra',city:'Gujarat',latitude:22.84,longitude:69.72,status:'HEALTHY'}]}))
app.get('/api/sustainability',async(req,res)=>{
  const suppliers=await getFallbackSuppliers(prisma)
  const components=await getComponents(prisma)
  const totalCo2=components.reduce((s,c)=>s+c.co2PerUnit*1000,0)
  res.json({totalCo2Kg:Math.round(totalCo2),co2PerPack:Math.round(totalCo2/800),domesticCo2Kg:Math.round(totalCo2*0.44),transportCo2Kg:Math.round(totalCo2*0.31),methods:components.map(c=>({component:c.code,co2PerUnit:c.co2PerUnit,source:'Illustrative factors, not verified carbon accounting'})),alternatives:suppliers.filter(s=>s.domestic).slice(0,5)})
})

app.post('/api/scenarios/compare',async(req,res)=>{
  const p=req.body
  const common={demand:p.demand||1000,tariffIncrease:p.tariffIncrease||35,currencyDepreciation:p.currencyDepreciation||0,fxRate:p.fxRate,fxSource:p.fxSource,inventoryLevel:p.inventoryLevel||100}
  const base=await runVoltRoute({...common,strategy:p.strategy||'BALANCED'})
  const costVariant=await runVoltRoute({...common,strategy:'COST'})
  const domesticVariant=await runVoltRoute({...common,strategy:'DOMESTIC'})
  res.json({custom:base,costOptimized:costVariant,domesticHeavy:domesticVariant,lowestRisk:await runVoltRoute({...common,strategy:'LOW_RISK'})})
})

app.get('/api/integrations',async(req,res)=>{
  res.json(await getExternalDataSources(prisma))
})
app.get('/api/fx/latest',async(req,res)=>{
  const base=String(req.query.base||'USD').toUpperCase()
  const symbols=String(req.query.symbols||'INR,EUR,CNY').split(',').map(value=>value.trim().toUpperCase()).filter(Boolean)
  try {
    const data=await getFxLatest(prisma,base,symbols,payload=>io.emit('fx:update',payload),{forceRefresh:req.query.refresh==='true'})
    res.json(data)
  } catch(error) {
    res.status(400).json({error:error.message})
  }
})
app.get('/api/adapters/currency',async(req,res)=>{
  try {
    res.json(await getCurrencyRate(prisma,req.query.base||'USD',req.query.quote||'INR',req.query.amount||1,payload=>io.emit('fx:update',payload)))
  } catch(error) {
    res.status(400).json({error:error.message})
  }
})
app.get('/api/adapters/news', async (req,res)=>{
  res.json(await getNews(prisma))
})
app.get('/api/adapters/weather', async (req,res)=>{
  const locations=String(req.query.locations||'Chakan').split(',').map(v=>v.trim()).filter(Boolean)
  res.json(await getWeather(prisma,locations))
})
app.get('/api/adapters/ai-status',async(req,res)=>res.json(await getOllamaStatus()))

app.get('/api/maritime/routes',async(req,res)=>{
  const routes=[
    {code:'CN-IN-SG',name:'China / Korea / Japan via Singapore',origin:'Shanghai / Busan / Tokyo',destination:'Nhava Sheva / Mundra',distanceKm:7800,transitDays:21,planningCost:1850000,insurancePct:0.12,riskScore:42,status:'MONITOR',sourceLabel:'Planning estimate; not a commercial freight quote',waypoints:[[31.23,121.47],[1.26,103.84],[18.95,72.95],[22.84,69.72]]},
    {code:'EU-IN-SUEZ',name:'Europe via Suez and Red Sea',origin:'Rotterdam / Hamburg / Antwerp',destination:'Nhava Sheva / Mundra',distanceKm:10500,transitDays:27,planningCost:2400000,insurancePct:0.18,riskScore:68,status:'ELEVATED_RISK',sourceLabel:'Planning estimate; GDELT and AIS evidence must be verified',waypoints:[[51.92,4.48],[36.13,43.15],[29.95,32.56],[12.54,43.33],[18.95,72.95]]},
    {code:'EU-IN-CAPE',name:'Europe via Cape of Good Hope',origin:'Rotterdam / Hamburg / Antwerp',destination:'Nhava Sheva / Mundra',distanceKm:13500,transitDays:35,planningCost:3200000,insurancePct:0.12,riskScore:48,status:'ALTERNATIVE',sourceLabel:'Planning estimate; maritime transit distance is approximate',waypoints:[[51.92,4.48],[-34.36,18.47],[-25.0,57.0],[18.95,72.95]]},
    {code:'GULF-IN-HORMUZ',name:'Persian Gulf via Strait of Hormuz',origin:'Jebel Ali / Gulf ports',destination:'India west coast',distanceKm:2100,transitDays:7,planningCost:620000,insurancePct:0.25,riskScore:72,status:'ELEVATED_RISK',sourceLabel:'Planning estimate; traffic and closure require source confirmation',waypoints:[[25.02,55.06],[26.56,56.25],[24.0,58.0],[18.95,72.95]]},
    {code:'SEA-IN-SG',name:'Vietnam / Malaysia / Indonesia via Singapore',origin:'Ho Chi Minh / Jakarta / Port Klang',destination:'Nhava Sheva / Mundra',distanceKm:5200,transitDays:15,planningCost:1250000,insurancePct:0.10,riskScore:35,status:'MONITOR',sourceLabel:'Planning estimate; not a carrier schedule',waypoints:[[10.82,106.82],[1.26,103.84],[18.95,72.95]]},
  ]
  res.json({source:'VoltGrid maritime route catalogue',status:'PLANNING_ESTIMATES',retrievedAt:new Date().toISOString(),routes})
})
app.get('/api/maritime/hormuz',async(req,res)=>{
  try {
    const response=await fetch('https://hormuz.data-tracking.net/api/summary?hours=24',{signal:AbortSignal.timeout(7000)})
    if(!response.ok) throw new Error(`Hormuz API HTTP ${response.status}`)
    const data=await response.json()
    res.json({source:'Hormuz data-tracking.net',status:'CONNECTED',retrievedAt:new Date().toISOString(),data})
  } catch(error) {
    res.json({source:'Hormuz data-tracking.net',status:'OFFLINE',retrievedAt:new Date().toISOString(),data:null,warning:`Source unavailable: ${error.message}. AIS traffic is not fabricated or inferred.`})
  }
})
app.post('/api/assistant/query',auth,async(req,res)=>{
  const [supplierResult,orderResult,incidents,allocations]=await Promise.all([
    fetchSuppliers(),
    fetchPurchaseOrders(),
    getIncidents(prisma,{include:{riskAssessments:true,complianceAssessments:true,allocations:{include:{supplier:true}}},orderBy:{createdAt:'desc'},take:5}),
    getSupplierAllocations(prisma,{include:{supplier:true},orderBy:{createdAt:'desc'},take:20}),
  ])
  const suppliers=supplierResult.data
  const orders=orderResult.data
  const question=String(req.body.question||'').trim()
  if(!question) return res.status(400).json({error:'Question is required'})
  if(question.length>1200) return res.status(400).json({error:'Question must be 1200 characters or fewer'})
  const q=question.toLowerCase()
  let answer
  const latest=incidents[0]
  const latestRisk=latest?.riskAssessments?.[0]
  const latestCompliance=latest?.complianceAssessments?.[0]
  const highestRisk=[...suppliers].sort((a,b)=>b.riskScore-a.riskScore)[0]
  const atRiskOrders=orders.filter(o=>o.status==='AT_RISK'||o.approvalStatus==='PENDING')
  const latestAllocation=allocations[0]

  if(q.includes('replace')||q.includes('alternative supplier')||q.includes('replace the disrupted')) {
    const alternatives=suppliers.filter(s=>s.domestic).sort((a,b)=>b.reliability-a.reliability).slice(0,3)
    answer=alternatives.length
      ? `Domestic replacement candidates are ${alternatives.map(s=>`${s.name} (${s.code}, ${s.reliability}% reliability)`).join('; ')}. Capacity and quality still require allocation validation.`
      : 'No explicit domestic replacement supplier is available in the seeded records.'
  } else if(q.includes('exposed')||q.includes('tariff')) {
    answer=`The supplier most exposed is ${highestRisk?.name||'not available'} (${highestRisk?.code||'no code'}) with a seed risk score of ${highestRisk?.riskScore||0}/100. China-linked exposure is a simulation signal and requires customs verification.`
  } else if(q.includes('dva')||q.includes('pli')||q.includes('domestic')) {
    const dva=latestCompliance?.dva ?? 58.4
    answer=`The latest proposed allocation DVA is ${Number(dva).toFixed(1)}%. The configured prototype threshold is 50%, with a 52% safe buffer. This is not verified legal PLI compliance.`
  } else if(q.includes('purchase')||q.includes('po')||q.includes('order')||q.includes('at risk')) {
    answer=atRiskOrders.length
      ? `${atRiskOrders.length} purchase order(s) are currently at risk: ${atRiskOrders.map(o=>o.poNumber).join(', ')}. Combined exposure is ₹${(atRiskOrders.reduce((sum,o)=>sum+o.totalValue,0)/100000).toFixed(1)} lakh.`
      : 'No purchase order is currently marked AT_RISK or PENDING.'
  } else if(q.includes('financial')||q.includes('cost')||q.includes('savings')||q.includes('impact')) {
    const exposure=latestRisk?.financialExposure ?? atRiskOrders.reduce((sum,o)=>sum+o.totalValue,0)
    answer=`The current calculated financial exposure is ₹${(Number(exposure)/100000).toFixed(1)} lakh${latest?.incidentId?` for incident ${latest.incidentId}`:''}. This is a simulation estimate, not a verified customs or ERP posting.`
  } else if(q.includes('risk')||q.includes('incident')||q.includes('stockout')) {
    answer=latestRisk
      ? `Incident ${latest.incidentId} has a weighted risk score of ${latestRisk.overallRisk}/100, stockout probability ${latestRisk.stockoutProbability}%, and financial exposure ₹${(latestRisk.financialExposure/100000).toFixed(1)} lakh.`
      : 'No completed incident risk record exists; trigger the disruption simulator to calculate a score.'
  } else if(q.includes('supplier')&&q.includes('select')) {
    answer=latestAllocation
      ? `The latest allocation selected ${latestAllocation.supplier.name} (${latestAllocation.supplier.code}) for ${latestAllocation.quantity} units at ₹${latestAllocation.landedCost.toFixed(2)} landed value. Reason: ${latestAllocation.reason}.`
      : 'No supplier allocation exists yet. Run the live disruption simulator or agent orchestration first.'
  } else if(q.includes('resilien')||q.includes('strateg')) {
    answer='For the strongest balance of cost and risk, compare Balanced, Domestic Heavy and Lowest Risk in the Scenario Laboratory. Domestic-heavy strategies improve concentration resilience but may increase landed cost.'
  } else {
    answer=`VoltGrid found ${suppliers.length} suppliers, ${orders.length} purchase orders and ${incidents.length} recent incident(s). Ask about DVA, tariff exposure, supplier replacement, at-risk POs, financial impact, incident risk, or the latest allocation.`
  }

  const provider=String(process.env.LLM_PROVIDER||'fallback').trim().toLowerCase()
  let source='Deterministic database-grounded fallback'
  if(provider==='sap-genai-hub') {
    const evidence={
      deterministicSummary:answer,
      suppliers:suppliers.map(s=>({code:s.code,name:s.name,country:s.country,domestic:s.domestic,dvaEligible:s.dvaEligible,reliability:s.reliability,riskScore:s.riskScore})),
      atRiskPurchaseOrders:atRiskOrders.map(o=>({poNumber:o.poNumber,status:o.status,approvalStatus:o.approvalStatus,totalValue:o.totalValue,supplier:o.supplier.name,country:o.supplier.country})),
      recentIncidents:incidents.map(i=>({
        incidentId:i.incidentId,title:i.title,status:i.status,
        risk:i.riskAssessments?.[0]?{overallRisk:i.riskAssessments[0].overallRisk,stockoutProbability:i.riskAssessments[0].stockoutProbability,financialExposure:i.riskAssessments[0].financialExposure}:null,
        compliance:i.complianceAssessments?.[0]?{dva:i.complianceAssessments[0].dva,result:i.complianceAssessments[0].result}:null,
        allocations:i.allocations?.map(a=>({supplier:a.supplier.name,quantity:a.quantity,landedCost:a.landedCost,reason:a.reason}))||[],
      })),
      latestAllocation:latestAllocation?{supplier:latestAllocation.supplier.name,quantity:latestAllocation.quantity,landedCost:latestAllocation.landedCost,reason:latestAllocation.reason}:null,
    }
    try {
      const generated=await generateSapGenAiAnswer({question,evidence})
      answer=generated.answer
      source=`SAP Generative AI Hub · ${generated.model}`
    } catch(error) {
      if(error instanceof SapGenAiConfigurationError) return res.status(503).json({error:error.message,code:error.code})
      console.error('SAP Generative AI Hub request failed:',error?.message||'Unknown provider error')
      return res.status(502).json({error:'SAP Generative AI Hub request failed. Check backend logs, AI Core credentials, orchestration deployment, and model availability.'})
    }
  } else if(provider!=='fallback') {
    if(provider==='ollama'||provider==='auto') {
      try {
        const local=await askOllama(`Summarize this database-grounded procurement finding for an executive audience. Do not calculate values or approve purchases. Finding: ${answer}`)
        if(local) { answer=local.answer; source=local.source }
      } catch(error) {
        source='Deterministic database-grounded fallback'
      }
    } else {
      return res.status(503).json({error:`Unsupported LLM_PROVIDER "${provider}". Use "sap-genai-hub", "ollama", "auto", or "fallback".`})
    }
  }

  res.json({
    answer,
    citations:[
      ...incidents.slice(0,2).map(i=>i.incidentId),
      ...suppliers.filter(s=>s.riskScore>=85).slice(0,2).map(s=>s.code),
      ...atRiskOrders.slice(0,2).map(o=>o.poNumber),
    ],
    source,
  })
})

app.get('/api/reports/:type/pdf',async(req,res)=>{
  res.setHeader('Content-Type','application/pdf')
  res.setHeader('Content-Disposition',`attachment; filename="voltgrid-${req.params.type}.pdf"`)
  const doc=new PDFDocument({margin:50})
  doc.pipe(res)
  doc.fillColor('#142C43').fontSize(22).text('VoltGrid AI')
  doc.fillColor('#1C2A38').fontSize(14).text(`${req.params.type.replace(/-/g,' ').toUpper()} Report`)
  doc.moveDown().fontSize(10).text(`Generated: ${new Date().toISOString()}`)
  doc.text('Illustrative enterprise prototype. External policy values require verification.')
  doc.moveDown().text('Executive summary')
  doc.text('VoltGrid combines disruption sensing, transparent risk assessment, constrained supplier optimization and human-governed ERP simulation.')
  doc.end()
})
app.use('/api',(req,res)=>res.status(404).json({error:'API route not found'}))

app.use(express.static(frontendDistPath))

app.use((req, res, next) => {
  if (req.method !== 'GET') return next()
  res.sendFile(path.join(frontendDistPath, 'index.html'), error => {
    if (error) next(error)
  })
})

app.use((error,req,res,next)=>{
  if(res.headersSent) return next(error)
  console.error('Request failed:',error?.code||'request error')
  res.status(500).json({error:'Internal server error'})
})

io.on('connection',socket=>socket.emit('connected',{status:'READY'}))
const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'
httpServer.listen(port,host,()=>console.log(`VoltGrid server listening on port ${port}`))
