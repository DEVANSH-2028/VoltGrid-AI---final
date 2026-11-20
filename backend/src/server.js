import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import multer from 'multer'
import PDFDocument from 'pdfkit'
import { calculateRisk } from './engines/risk.js'
import { runVoltSense } from './agents/voltSense.js'
import { runVoltRoute } from './agents/voltRoute.js'
import { runVoltGuard } from './agents/voltGuard.js'

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, { cors:{ origin:'*' } })
const prisma = new PrismaClient()
const port = Number(process.env.PORT || 4000)
const upload = multer({ storage:multer.memoryStorage(), limits:{ fileSize:10*1024*1024 } })

app.use(cors())
app.use(express.json({limit:'2mb'}))

function auth(req,res,next) {
  const token=req.headers.authorization?.replace(/^Bearer /,'')
  if(!token) return res.status(401).json({error:'Authentication required'})
  try { req.user=jwt.verify(token,process.env.JWT_SECRET||'dev-secret'); next() }
  catch { res.status(401).json({error:'Invalid session'}) }
}

function emit(kind,payload) { io.emit('agent:event',{kind,payload,at:new Date().toISOString()}) }
async function audit(action,entityType,actor,details,incidentId) {
  await prisma.auditLog.create({data:{action,entityType,actor,detailsJson:JSON.stringify(details),incidentId}})
}

app.get('/api/health',(req,res)=>res.json({status:'ok',database:'SQLite',mode:'LOCAL_DEMO'}))
app.post('/api/auth/login',async(req,res)=>{
  const {email,password}=req.body
  const user=await prisma.user.findUnique({where:{email}})
  if(!user || !await bcrypt.compare(password||'',user.password)) return res.status(401).json({error:'Invalid demo credentials'})
  const token=jwt.sign({id:user.id,name:user.name,email:user.email,role:user.role},process.env.JWT_SECRET||'dev-secret',{expiresIn:'12h'})
  res.json({token,user:{id:user.id,name:user.name,email:user.email,role:user.role}})
})
app.get('/api/auth/me',auth,(req,res)=>res.json({user:req.user}))

app.get('/api/dashboard',async(req,res)=>{
  const [suppliers,components,plant,orders,disruptions,incidents,approvals,inventory] = await Promise.all([
    prisma.supplier.findMany(),prisma.component.findMany(),prisma.plant.findFirst(),prisma.purchaseOrder.findMany({include:{supplier:true,items:{include:{component:true}}}}),
    prisma.disruptionEvent.findMany({orderBy:{createdAt:'desc'},take:6}),prisma.incident.findMany({orderBy:{createdAt:'desc'},take:5}),
    prisma.approval.findMany({where:{status:'PENDING'},include:{incident:true},take:5}),prisma.inventory.findMany({include:{component:true}})
  ])
  const spendByCountry={}
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
    disruptions,incidents,approvals,orders:orders.slice(0,6),integrations:await prisma.externalDataSource.findMany()
  })
})

app.get('/api/suppliers',async(req,res)=>res.json(await prisma.supplier.findMany({orderBy:{riskScore:'desc'}})))
app.get('/api/suppliers/:id',async(req,res)=>res.json(await prisma.supplier.findUnique({where:{id:req.params.id}})))
app.get('/api/inventory',async(req,res)=>res.json(await prisma.inventory.findMany({include:{component:true,plant:true}})))
app.get('/api/components',async(req,res)=>res.json(await prisma.component.findMany()))
app.get('/api/plants',async(req,res)=>res.json(await prisma.plant.findMany()))

app.get('/api/procurement/orders',async(req,res)=>res.json(await prisma.purchaseOrder.findMany({include:{supplier:true,plant:true,items:{include:{component:true,supplier:true}}},orderBy:{createdAt:'desc'}})))
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

app.get('/api/incidents',async(req,res)=>res.json(await prisma.incident.findMany({include:{agentExecutions:true,riskAssessments:true,approvals:true,allocations:true,complianceAssessments:true},orderBy:{createdAt:'desc'}})))
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
  const route=await runVoltRoute({demand:incident.demand,tariffIncrease:incident.tariffIncrease,inventoryLevel:incident.inventoryLevel,strategy:'BALANCED'})
  await prisma.agentExecution.create({data:{incidentId:incident.id,agentName:'VOLTROUTE',status:'COMPLETE',inputJson:JSON.stringify({demand:incident.demand,tariffIncrease:incident.tariffIncrease}),outputJson:JSON.stringify(route),confidence:0.94,durationMs:Date.now()-routeStart}})
  emit('VOLTROUTE_COMPLETE',{incidentId:incident.incidentId,allocation:route.allocation})

  await prisma.supplierAllocation.deleteMany({where:{incidentId:incident.id}})
  for(const item of route.allocation){
    await prisma.supplierAllocation.create({data:{incidentId:incident.id,supplierId:item.supplierId,componentId:(await prisma.component.findFirst({where:{code:'LFP-CELL'}})).id,quantity:item.quantity,unitCost:item.unitCost,landedCost:item.landedCost,delayDays:item.delayDays,reason:item.reason}})
  }

  const guard=runVoltGuard(route)
  await prisma.agentExecution.create({data:{incidentId:incident.id,agentName:'VOLTGUARD',status:'COMPLETE',inputJson:JSON.stringify({dva:route.dva}),outputJson:JSON.stringify(guard),confidence:0.98,durationMs:42}})
  await prisma.complianceAssessment.create({data:{incidentId:incident.id,dva:guard.dva,target:50,result:guard.result,detailsJson:JSON.stringify(guard)}})
  emit('VOLTGUARD_COMPLETE',{incidentId:incident.incidentId,compliance:guard})

  const requiresHuman = route.totalValue>500000 || guard.result==='WARNING'||guard.result==='CRITICAL'||risk.overallRisk>=70
  const approval=await prisma.approval.create({data:{incidentId:incident.id,status:requiresHuman?'PENDING':'APPROVED',financialImpact:route.totalValue,proposedJson:JSON.stringify(route),decisionNote:requiresHuman?'Human governance review required':'Autonomous execution zone'}})
  if(!requiresHuman) await prisma.incident.update({where:{id:incident.id},data:{status:'APPROVED'}})
  else await prisma.incident.update({where:{id:incident.id},data:{status:'AWAITING_APPROVAL'}})
  await audit('ORCHESTRATION_COMPLETED','INCIDENT', 'SYSTEM',{risk:risk.overallRisk,compliance:guard.result,approval:approval.status},incident.id)
  emit('ORCHESTRATION_COMPLETE',{incidentId:incident.incidentId,status:requiresHuman?'AWAITING_APPROVAL':'APPROVED'})
  return prisma.incident.findUnique({where:{id:incident.id},include:{agentExecutions:true,riskAssessments:true,allocations:{include:{supplier:true}},complianceAssessments:true,approvals:true}})
}

app.post('/api/simulator/trigger',auth,async(req,res)=>{
  const p=req.body
  const disruption=await prisma.disruptionEvent.create({data:{type:p.type||'TARIFF',title:p.title||'Custom disruption scenario',description:p.description||'User-configured local disruption simulation',country:p.country||'China',severity:p.tariffIncrease>=35?'CRITICAL':'HIGH',source:'Live disruption simulator',confirmed:false}})
  const incident=await prisma.incident.create({data:{incidentId:`INC-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(Date.now()).slice(-5)}`,title:p.title||'China tariff shock',status:'CREATED',type:p.type||'TARIFF',tariffIncrease:Number(p.tariffIncrease||35),delayDays:Number(p.delayDays||14),currencyDepreciation:Number(p.currencyDepreciation||0),supplierCapacityReduction:Number(p.supplierCapacityReduction||0),inventoryLevel:Number(p.inventoryLevel||100),demand:Number(p.demand||1000),disruptionEventId:disruption.id}})
  await audit('INCIDENT_CREATED','INCIDENT',req.user.email,{type:incident.type,tariffIncrease:incident.tariffIncrease},incident.id)
  res.status(201).json(await executeIncident(incident))
})
app.post('/api/simulator/reset',auth,async(req,res)=>{
  await audit('SIMULATION_RESET','SYSTEM',req.user.email,{message:'Simulation state reset requested'},null)
  res.json({status:'RESET',message:'Seed ERP and incident state retained; create a new scenario to run from baseline'})
})

app.get('/api/approvals',async(req,res)=>res.json(await prisma.approval.findMany({include:{incident:{include:{riskAssessments:true,complianceAssessments:true,allocations:{include:{supplier:true}}}}},orderBy:{createdAt:'desc'}})))
app.post('/api/approvals/:id/:action',auth,async(req,res)=>{
  if(!['approve','reject','revise'].includes(req.params.action)) return res.status(400).json({error:'Invalid action'})
  const approval=await prisma.approval.findUnique({where:{id:req.params.id},include:{incident:true}})
  if(!approval) return res.status(404).json({error:'Approval not found'})
  if(req.params.action==='approve') {
    await prisma.approval.update({where:{id:approval.id},data:{status:'APPROVED',approverId:req.user.id,decisionNote:req.body.note||'Approved through human governance'}})
    await prisma.incident.update({where:{id:approval.incidentId},data:{status:'APPROVED'}})
    const allocations=await prisma.supplierAllocation.findMany({where:{incidentId:approval.incidentId}})
    for(const allocation of allocations) {
      const supplier=await prisma.supplier.findUnique({where:{id:allocation.supplierId}})
      await prisma.purchaseOrder.create({data:{poNumber:`ERP-${String(Date.now()).slice(-8)}-${supplier.code}`,plantId:(await prisma.plant.findFirst()).id,supplierId:supplier.id,status:'APPROVED',totalValue:allocation.landedCost,approvalStatus:'APPROVED',erpSynced:true}})
    }
  } else {
    await prisma.approval.update({where:{id:approval.id},data:{status:req.params.action==='reject'?'REJECTED':'REVISION_REQUESTED',approverId:req.user.id,decisionNote:req.body.note||req.params.action}})
    await prisma.incident.update({where:{id:approval.incidentId},data:{status:req.params.action==='reject'?'REJECTED':'REVISION_REQUESTED'}})
  }
  await audit(`APPROVAL_${req.params.action.toUpperCase()}`,'APPROVAL',req.user.email,{approvalId:approval.id,note:req.body.note},approval.incidentId)
  res.json(await prisma.approval.findUnique({where:{id:approval.id},include:{incident:true}}))
})

app.get('/api/compliance',async(req,res)=>{
  const assessments=await prisma.complianceAssessment.findMany({include:{incident:true},orderBy:{createdAt:'desc'},take:20})
  res.json({target:50,safeBuffer:52,currentDva:assessments[0]?.dva||58.4,assessments,suppliers:await prisma.supplier.findMany({where:{dvaEligible:true}})})
})
app.get('/api/audit',async(req,res)=>{
  const {incidentId,action,q}=req.query
  const logs=await prisma.auditLog.findMany({where:{AND:[incidentId?{incidentId:String(incidentId)}:{},action?{action:{contains:String(action),mode:'insensitive'}}:{}]},orderBy:{createdAt:'desc'},take:500})
  res.json(logs)
})
app.get('/api/audit/export',async(req,res)=>{
  res.setHeader('Content-Type','text/csv')
  res.setHeader('Content-Disposition','attachment; filename="voltgrid-audit.csv"')
  const logs=await prisma.auditLog.findMany({orderBy:{createdAt:'desc'}})
  res.send('timestamp,action,entityType,actor,details\n'+logs.map(l=>`"${l.createdAt.toISOString()}","${l.action}","${l.entityType}","${l.actor}","${l.detailsJson.replace(/"/g,'""')}"`).join('\n'))
})

app.post('/api/documents/upload',upload.single('document'),async(req,res)=>{
  if(!req.file) return res.status(400).json({error:'Document is required'})
  const extractedText=req.file.mimetype==='application/pdf'?'PDF text extraction is ready for verification; policy text requires manual confirmation.':'Document received. Text extraction supports uploaded policy documents.'
  const doc=await prisma.uploadedDocument.create({data:{fileName:req.file.originalname,mimeType:req.file.mimetype,extractedText}})
  res.status(201).json(doc)
})
app.post('/api/documents/:id/verify',auth,async(req,res)=>res.json(await prisma.uploadedDocument.update({where:{id:req.params.id},data:{verified:true}})))

app.get('/api/twin',async(req,res)=>res.json({plant:await prisma.plant.findFirst(),suppliers:await prisma.supplier.findMany(),ports:[{name:'Nhava Sheva',city:'Mumbai',latitude:18.95,longitude:72.95,status:'WARNING'},{name:'Mundra',city:'Gujarat',latitude:22.84,longitude:69.72,status:'HEALTHY'}]}))
app.get('/api/sustainability',async(req,res)=>{
  const suppliers=await prisma.supplier.findMany()
  const components=await prisma.component.findMany()
  const totalCo2=components.reduce((s,c)=>s+c.co2PerUnit*1000,0)
  res.json({totalCo2Kg:Math.round(totalCo2),co2PerPack:Math.round(totalCo2/800),domesticCo2Kg:Math.round(totalCo2*0.44),transportCo2Kg:Math.round(totalCo2*0.31),methods:components.map(c=>({component:c.code,co2PerUnit:c.co2PerUnit,source:'Illustrative factors, not verified carbon accounting'})),alternatives:suppliers.filter(s=>s.domestic).slice(0,5)})
})

app.post('/api/scenarios/compare',async(req,res)=>{
  const p=req.body
  const suppliers=await prisma.supplier.findMany()
  const base=await runVoltRoute({demand:p.demand||1000,tariffIncrease:p.tariffIncrease||35,inventoryLevel:p.inventoryLevel||100,strategy:p.strategy||'BALANCED'})
  const costVariant=await runVoltRoute({demand:p.demand||1000,tariffIncrease:p.tariffIncrease||35,strategy:'COST'})
  const domesticVariant=await runVoltRoute({demand:p.demand||1000,tariffIncrease:p.tariffIncrease||35,strategy:'DOMESTIC'})
  res.json({custom:base,costOptimized:costVariant,domesticHeavy:domesticVariant,lowestRisk:await runVoltRoute({demand:p.demand||1000,tariffIncrease:p.tariffIncrease||35,strategy:'LOW_RISK'})})
})

app.get('/api/integrations',async(req,res)=>{
  res.json(await prisma.externalDataSource.findMany())
})
app.get('/api/adapters/currency', async (req,res)=>{
  const base=Number(req.query.amount||1)
  try {
    const response=await fetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR',{signal:AbortSignal.timeout(5000)})
    if(!response.ok) throw new Error(`Frankfurter status ${response.status}`)
    const data=await response.json()
    const rate=Number(data.rates?.INR||83.12)
    res.json({source:'Frankfurter',rate,convertedInr:Number((base*rate).toFixed(2)),verified:true,at:data.date||new Date().toISOString()})
  } catch {
    res.json({source:'Deterministic fallback',rate:83.12,convertedInr:Number((base*83.12).toFixed(2)),verified:false,at:new Date().toISOString()})
  }
})
app.get('/api/adapters/news', async (req,res)=>{
  res.json({source:'GDELT adapter',status:'DEMO_SIGNAL',items:[
    {title:'Illustrative tariff-policy signal',classification:'requires verification',freshness:'Current session'},
    {title:'Illustrative port-congestion signal',classification:'simulated logistics context',freshness:'Current session'}
  ]})
})
app.get('/api/adapters/weather', async (req,res)=>{
  res.json({source:'Open-Meteo adapter',status:'DEMO_SIGNAL',location:'Chakan, Pune',temperatureC:27,disruptionIndicator:'MODERATE',verified:false})
})
app.post('/api/assistant/query',auth,async(req,res)=>{
  const [suppliers,orders,incidents,allocations]=await Promise.all([
    prisma.supplier.findMany(),
    prisma.purchaseOrder.findMany({include:{supplier:true}}),
    prisma.incident.findMany({include:{riskAssessments:true,complianceAssessments:true,allocations:{include:{supplier:true}}},orderBy:{createdAt:'desc'},take:5}),
    prisma.supplierAllocation.findMany({include:{supplier:true},orderBy:{createdAt:'desc'},take:20}),
  ])
  const q=String(req.body.question||'').toLowerCase()
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
  res.json({
    answer,
    citations:[
      ...incidents.slice(0,2).map(i=>i.incidentId),
      ...suppliers.filter(s=>s.riskScore>=85).slice(0,2).map(s=>s.code),
      ...atRiskOrders.slice(0,2).map(o=>o.poNumber),
    ],
    source:'Deterministic database-grounded fallback',
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

io.on('connection',socket=>socket.emit('connected',{status:'READY'}))
httpServer.listen(port,()=>console.log(`VoltGrid API listening on http://localhost:${port}`))
