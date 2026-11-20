import React, {useEffect,useState} from 'react'
import {Routes,Route,Navigate,useNavigate} from 'react-router-dom'
import {LayoutDashboard,Network,Users,TriangleAlert,Bot,SlidersHorizontal,ShoppingCart,Split,ShieldCheck,Activity,Leaf,FlaskConical,CheckCircle2,FileClock,FileText,PlugZap,Settings as SettingsIcon,Menu,Search,Bell,ChevronDown,LogOut,MapPin,PackageCheck,Download,Play,RefreshCw,Sparkles} from 'lucide-react'
import {LineChart,Line,BarChart,Bar,XAxis,YAxis,Tooltip,ResponsiveContainer,PieChart,Pie,Cell,AreaChart,Area} from 'recharts'

const API='http://localhost:4000/api'
const colors=['#1769AA','#16A6D9','#26966B','#E39A28','#C94B42']
async function api(path,options={}) {
  const token=localStorage.getToken?.()||localStorage.getItem('vg_token')
  const r=await fetch(API+path,{...options,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{}),...options.headers}})
  if(!r.ok) throw new Error(await r.text())
  return r.json()
}

function Logo(){return <div className="brand"><svg viewBox="0 0 42 42" aria-label="VoltGrid logo"><rect x="5" y="7" width="32" height="28" rx="5" fill="#142C43"/><path d="M11 12h8v8h-8zm12 10h8v8h-8z" fill="#16A6D9"/><path d="M19 16h4v6h8M19 28h-4v-8" fill="none" stroke="#26966B" strokeWidth="2.5"/></svg><div><strong>VoltGrid</strong><span>AI CONTROL TOWER</span></div></div>}

function Login({onLogin}) {
  const [email,setEmail]=useState('planner@voltgrid.ai'),[password,setPassword]=useState('VoltGrid!2026'),[error,setError]=useState('')
  async function submit(e){e.preventDefault();try{const data=await api('/auth/login',{method:'POST',body:JSON.stringify({email,password})});localStorage.setItem('vg_token',data.token);localStorage.setItem('vg_user',JSON.stringify(data.user));onLogin(data.user)}catch(e){setError('Unable to sign in. Check the demo credentials.')}} 
  return <div className="login"><section className="login-brand"><Logo/><div><span className="eyebrow">ENTERPRISE CONTROL TOWER</span><h1>Resilience starts with<br/>a connected supply chain.</h1><p>Autonomous sensing, procurement optimization and human-governed ERP execution.</p></div></section><main><form onSubmit={submit} className="login-card"><span className="eyebrow">AUTHORIZED ACCESS</span><h2>Sign in to VoltGrid</h2><label>Email address<input value={email} onChange={e=>setEmail(e.target.value)} type="email"/></label><label>Password<input value={password} onChange={e=>setPassword(e.target.value)} type="password"/></label>{error&&<div className="error">{error}</div>}<button className="primary" type="submit">Sign in</button><div className="demo-users"><b>Demo users</b><span>Planner · Manager · Auditor</span></div></form></main></div>
}

const nav=[
  ['Control Tower','/','dashboard',LayoutDashboard],['Digital Twin','/twin','SUPPLY NETWORK',Network],['Supplier Network','/suppliers','',Users],
  ['Disruption Intelligence','/disruptions','',TriangleAlert],['Agent Operations','/agents','',Bot],['Live Simulator','/simulator','',SlidersHorizontal],
  ['Procurement','/procurement','PROCUREMENT',ShoppingCart],['Split-Order Optimization','/optimization','',Split],['PLI Compliance','/compliance','',ShieldCheck],
  ['Risk Intelligence','/risk','RESILIENCE',Activity],['Sustainability','/sustainability','',Leaf],['Scenario Laboratory','/scenarios','',FlaskConical],
  ['Approvals','/approvals','GOVERNANCE',CheckCircle2],['Audit Trail','/audit','',FileClock],['Executive Reports','/reports','',FileText],
  ['Integrations','/integrations','SYSTEM',PlugZap],['Settings','/settings','',SettingsIcon]
]

function Shell({user,onLogout,children}) {
  const [open,setOpen]=useState(false);const navigate=useNavigate()
  let label='Control Tower'
  for(const n of nav) if(location.pathname===n[1]) label=n[0]
  return <div className="app-shell"><aside className={open?'open':''}><Logo/><nav>{nav.map(([name,path,section,Icon])=><React.Fragment key={path}>{section&&<div className="nav-section">{section}</div>}<button onClick={()=>{navigate(path);setOpen(false)}} className={location.pathname===path?'active':''}><Icon size={18}/><span>{name}</span></button></React.Fragment>)}</nav></aside>{open&&<div className="scrim" onClick={()=>setOpen(false)}/>}<div className="main"><header><button className="icon-button menu" onClick={()=>setOpen(true)}><Menu/></button><div><span>VOLTGRID OPERATIONS</span><strong>{label}</strong></div><div className="header-actions"><button className="search"><Search size={16}/>Search records</button><button className="icon-button"><Bell size={18}/></button><button className="user" onClick={onLogout}><div>{user.name.split(' ').map(x=>x[0]).join('')}</div><span><b>{user.name}</b><small>{user.role}</small></span><ChevronDown size={14}/></button></div></header><main className="content">{children}</main></div></div>
}

function Kpi({label,value,detail,tone='blue',icon:Icon}){return <article className="kpi"><div className={`kpi-icon ${tone}`}><Icon size={19}/></div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>}
function PageTitle({title,subtitle,actions}){return <div className="page-title"><div><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>{actions}</div>}

function Dashboard(){
 const [d,setD]=useState(null),[loading,setLoading]=useState(true)
 useEffect(()=>{api('/dashboard').then(setD).finally(()=>setLoading(false))},[])
 async function grandDemo(){const r=await api('/simulator/trigger',{method:'POST',body:JSON.stringify({title:'35% tariff shock — LFP prismatic cells',type:'COMBINED',tariffIncrease:35,delayDays:21,inventoryLevel:68,demand:1200})});alert(`Grand Finale demo executed.\nIncident: ${r.incidentId}\nStatus: ${r.status}`);location.reload()}
 if(loading||!d)return <div className="loading">Loading control tower…</div>
 const k=d.kpis
 return <><PageTitle title="Executive Control Tower" subtitle="Chakan Plant · Live operating overview" actions={<button className="primary" onClick={grandDemo}><Play size={16}/>START GRAND FINALE DEMO</button>}/><section className="kpis">
 <Kpi label="Annual procurement" value={`₹${(k.procurementValue/10000000).toFixed(0)} Cr`} detail="+4.8% vs plan" tone="blue" icon={ShoppingCart}/>
 <Kpi label="Supplier network" value={k.supplierCount} detail="14 active countries" tone="green" icon={Users}/>
 <Kpi label="Overall risk" value={k.overallRisk} detail="Moderate" tone="amber" icon={Activity}/>
 <Kpi label="Domestic value" value={`${k.dva}%`} detail="+3.2 pts DVA" tone="green" icon={ShieldCheck}/>
 <Kpi label="Inventory coverage" value={`${k.inventoryCoverage}%`} detail="Across critical BOM" tone="blue" icon={PackageCheck}/>
 <Kpi label="At-risk POs" value={k.atRiskPOs} detail={`₹${(k.financialExposure/10000000).toFixed(1)} Cr exposed`} tone="red" icon={TriangleAlert}/>
 </section><section className="grid-12">
 <article className="panel span-8"><div className="panel-head"><div><b>Procurement spend by country</b><span>Annualized · INR</span></div><button>All categories <ChevronDown size={13}/></button></div><div className="chart"><ResponsiveContainer><BarChart data={d.spendByCountry}><XAxis dataKey="country"/><YAxis/><Tooltip/><Bar dataKey="value" fill="#1769AA" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></div></article>
 <article className="panel span-4"><div className="panel-head"><div><b>DVA composition</b><span>Target 50% · Safe 52%</span></div></div><div className="chart pie"><ResponsiveContainer><PieChart><Pie data={d.sourcing} dataKey="value" innerRadius={55} outerRadius={78} paddingAngle={2}>{d.sourcing.map((_,i)=><Cell key={i} fill={colors[i]}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer><div className="pie-center"><b>{k.dva}%</b><span>DVA</span></div></div></article>
 <article className="panel span-4"><div className="panel-head"><div><b>Critical alerts</b><span>Requires attention</span></div></div><div className="alerts">{d.disruptions.slice(0,3).map((x,i)=><div className="alert" key={x.id}><div className={`alert-dot ${i?'amber':'red'}`}/><div><b>{x.title}</b><span>{x.severity} · {x.source}</span></div></div>)}</div></article>
 <article className="panel span-4"><div className="panel-head"><div><b>Agent execution feed</b><span>Recent autonomous activity</span></div></div><div className="feed">{d.incidents.slice(0,4).map((x,i)=><div className="feed-row" key={x.id}><span className="feed-icon"><Bot size={15}/></span><div><b>{x.status}</b><span>{x.incidentId}</span></div><small>{i+1}m</small></div>)}</div></article>
 <article className="panel span-4"><div className="panel-head"><div><b>System integrations</b><span>Adapter status</span></div></div><div className="integrations">{d.integrations.slice(0,5).map((x,i)=><div key={x.id}><span className="status-dot"/><b>{x.name}</b><small>{x.status}</small></div>)}</div></article>
 </section></>
}

function Suppliers(){
 const [rows,setRows]=useState([])
 useEffect(()=>{api('/suppliers').then(setRows)},[])
 return <><PageTitle title="Supplier Network" subtitle="14 suppliers across 10 countries" actions={<button className="secondary"><Download size={15}/> Export</button>}/><article className="panel table-panel"><table><thead><tr><th>Supplier</th><th>Country</th><th>Capability</th><th>Quality</th><th>Reliability</th><th>Lead time</th><th>Risk</th><th>Status</th></tr></thead><tbody>{rows.map(s=><tr key={s.id}><td><b>{s.name}</b><small>{s.code}</small></td><td>{s.country}</td><td>{s.domestic?'Domestic':'International'} · {s.dvaEligible?'DVA eligible':'Not eligible'}</td><td>{s.qualityScore}%</td><td>{s.reliability}%</td><td>{s.leadTimeDays} days</td><td><span className={`risk ${s.riskScore>=70?'critical':s.riskScore>=50?'high':'low'}`}>{Math.round(s.riskScore)}</span></td><td><span className={`status  ${String(s.status).toLowerCase()} `}>{s.status}</span></td></tr>)}</tbody></table></article></>
}

function Procurement(){
 const [rows,setRows]=useState([])
 useEffect(()=>{api('/procurement/orders').then(setRows)},[])
 async function cancel(id){await api(`/procurement/orders/${id}/cancel`,{method:'POST'});setRows(await api('/procurement/orders'))}
 async function create(){
  const suppliers=await api('/suppliers')
  const components=await api('/components')
  const quantity=Number(window.prompt('Quantity','100')||0)
  const unitCost=Number(window.prompt('Unit cost (INR)','42')||0)
  if(!quantity||!unitCost) return
  await api('/procurement/orders',{method:'POST',body:JSON.stringify({supplierId:suppliers[0].id,componentId:components[0].id,quantity,unitCost,status:'OPEN'})})
  setRows(await api('/procurement/orders'))
 }
 return <><PageTitle title="Procurement Management" subtitle="Purchase orders and simulated ERP state" actions={<button className="primary" onClick={create}>Create purchase order</button>}/><article className="panel table-panel"><table><thead><tr><th>PO number</th><th>Supplier</th><th>Value</th><th>Status</th><th>Approval</th><th>ERP sync</th><th/></tr></thead><tbody>{rows.map(p=><tr key={p.id}><td><b>{p.poNumber}</b></td><td>{p.supplier.name}</td><td>₹{(p.totalValue/100000).toFixed(1)} lakh</td><td><span className="status">{p.status}</span></td><td>{p.approvalStatus}</td><td>{p.erpSynced?'Synced':'Pending'}</td><td>{p.status!=='CANCELLED'&&<button className="text-danger" onClick={()=>cancel(p.id)}>Cancel</button>}</td></tr>)}</tbody></table></article></>
}

function Generic({title,subtitle,items=[]}){return <><PageTitle title={title} subtitle={subtitle}/><article className="panel empty-state"><Sparkles size={28}/><h3>Operational workspace ready</h3><p>{items.join(' · ')||'Backend data and controls are available through the VoltGrid APIs.'}</p></article></>}

function Agents(){
 const [incident,setIncident]=useState(null)
 async function run(){const r=await api('/simulator/trigger',{method:'POST',body:JSON.stringify({title:'Agent orchestration review',type:'TARIFF',tariffIncrease:35,delayDays:14,inventoryLevel:72,demand:1000})});setIncident(r)}
 return (
  <>
   <PageTitle title="AI Agent Operations" subtitle="Independent agents coordinated through the orchestration engine" actions={<button className="primary" onClick={run}><Play size={16}/>Run orchestration</button>} />
   <section className="agent-grid">
    {['VOLTSENSE','VOLTROUTE','VOLTGUARD'].map((a,i)=>(
     <article className="agent-card" key={a}>
      <div className="agent-head">
       <span className={`agent-icon a${i}`}>{i===0?<TriangleAlert/>:i===1?<Split/>:<ShieldCheck/>}</span>
       <div><b>{a}</b><small>{i===0?'Disruption sensing':i===1?'Supplier optimization':'PLI compliance'}</small></div>
       <span className="status">COMPLETE</span>
      </div>
      <p>{i===0?'Policy, tariff and logistics exposure detection':i===1?'Constrained landed-cost and risk allocation':'Domestic value and procurement safeguards'}</p>
      <div className="agent-stat"><span>Confidence</span><b>{i===1?'94%':i===2?'98%':'96%'}</b></div>
     </article>
    ))}
   </section>
   {incident&&<article className="panel"><div className="panel-head"><div><b>Latest execution</b><span>{incident.incidentId}</span></div></div><pre>{JSON.stringify(incident,null,2)}</pre></article>}
  </>
 )
}

function Simulator(){
 const [p,setP]=useState({tariffIncrease:35,delayDays:14,currencyDepreciation:4,supplierCapacityReduction:20,inventoryLevel:68,demand:1000}),[r,setR]=useState(null)
 async function trigger(){setR(await api('/simulator/trigger',{method:'POST',body:JSON.stringify(p)}))}
 async function reset(){await api('/simulator/reset',{method:'POST'});setR(null)}
 const fields=[['tariffIncrease','Tariff increase (%)'],['delayDays','Logistics delay (days)'],['currencyDepreciation','INR depreciation (%)'],['supplierCapacityReduction','Supplier capacity reduction (%)'],['inventoryLevel','Inventory level (%)'],['demand','Production demand (%)']]
 return <><PageTitle title="Live Disruption Simulator" subtitle="Create a repeatable incident and execute the three-agent workflow" actions={<><button className="secondary" onClick={reset}><RefreshCw size={15}/>Reset</button><button className="primary" onClick={trigger}><Play size={15}/>Trigger disruption</button></>}/><div className="grid-12"><article className="panel span-4"><div className="panel-head"><b>Scenario controls</b></div><div className="controls">{fields.map(([key,label])=><label key={key}><span>{label}<b>{p[key]}</b></span><input type="range" min="0" max={key==='delayDays'?60:key==='demand'?150:100} value={p[key]} onChange={e=>setP({...p,[key]:Number(e.target.value)})}/></label>)}</div></article><article className="panel span-8"><div className="panel-head"><div><b>Execution timeline</b><span>{r?r.incidentId:'Awaiting scenario trigger'}</span></div></div>{r?<div className="timeline">{r.agentExecutions.map((x,i)=><div key={x.id}><span>{i+1}</span><div><b>{x.agentName}</b><small>{x.status} · {x.durationMs} ms</small></div></div>)}</div>:<div className="empty-small">Trigger the scenario to begin VoltSense → Risk → VoltRoute → VoltGuard.</div>}</article></div></>
}

function Approvals(){
 const [rows,setRows]=useState([])
 const load=()=>api('/approvals').then(setRows)
 useEffect(()=>{load()},[])
 async function act(id,action){await api(`/approvals/${id}/${action}`,{method:'POST',body:JSON.stringify({note:action==='approve'?'Approved by manager':'Decision recorded'})});load()}
 return <><PageTitle title="Approval Center" subtitle="Human governance for procurement and compliance decisions"/><div className="approval-list">{rows.map(a=><article className="approval-card" key={a.id}><div className="approval-top"><div><span className="incident-tag">{a.incident.incidentId}</span><b>{a.incident.title}</b></div> <span className={`status ${String(a.status).toLowerCase()}`}>{a.status}</span></div><div className="approval-grid"><div><span>Financial impact</span><b>₹{(a.financialImpact/100000).toFixed(1)} lakh</b></div><div><span>DVA result</span><b>{a.incident.complianceAssessments[0]?.dva?.toFixed(1)||'—'}%</b></div><div><span>Proposed action</span><b>{a.status==='PENDING'?'Human review':'Recorded decision'}</b></div></div>{a.status==='PENDING'&&<div className="approval-actions"><button className="danger-secondary" onClick={()=>act(a.id,'reject')}>Reject</button><button className="secondary" onClick={()=>act(a.id,'revise')}>Request revision</button><button className="primary" onClick={()=>act(a.id,'approve')}>Approve & execute ERP</button></div>}</article>)}</div></>
}

function Compliance(){
 const [d,setD]=useState(null);useEffect(()=>{api('/compliance').then(setD)},[])
 if(!d)return <div className="loading">Loading compliance…</div>
 return <><PageTitle title="PLI Compliance" subtitle="Prototype DVA safeguards — not verified legal advice" actions={<a className="secondary" href={`${API}/reports/pli-compliance/pdf`} target="_blank"><Download size={15}/>Download report</a>}/><section className="kpis"><Kpi label="Current DVA" value={`${d.currentDva}%`} detail="Demonstration baseline" tone="green" icon={ShieldCheck}/><Kpi label="Target threshold" value={`${d.target}%`} detail="Configured prototype" tone="blue" icon={Activity}/><Kpi label="Safe buffer" value="52%" detail="Above 52% is safe" tone="green" icon={CheckCircle2}/><Kpi label="DVA eligibility" value={d.suppliers.length} detail="Explicit supplier records" tone="amber" icon={Users}/></section><article className="panel table-panel"><table><thead><tr><th>Assessment</th><th>DVA</th><th>Target</th><th>Result</th><th>Timestamp</th></tr></thead><tbody>{d.assessments.map(x=><tr key={x.id}><td>{x.incident?.incidentId||'Baseline'}</td><td><b>{x.dva.toFixed(1)}%</b></td><td>{x.target}%</td> <td><span className={`status ${String(x.result).toLowerCase()}`}>{x.result}</span></td><td>{new Date(x.createdAt).toLocaleString()}</td></tr>)}</tbody></table></article></>
}

function Audit(){
 const [rows,setRows]=useState([]);useEffect(()=>{api('/audit').then(setRows)},[])
 return <><PageTitle title="Audit Trail" subtitle="Append-only governance and operational history" actions={<a className="secondary" href={`${API}/audit/export`} target="_blank"><Download size={15}/>Export CSV</a>}/><article className="panel table-panel"><table><thead><tr><th>Timestamp</th><th>Action</th><th>Entity</th><th>Actor</th><th>Details</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{new Date(r.createdAt).toLocaleString()}</td><td><b>{r.action}</b></td><td>{r.entityType}</td><td>{r.actor}</td><td className="detail-cell">{r.detailsJson}</td></tr>)}</tbody></table></article></>
}

function DigitalTwin(){
 const [d,setD]=useState(null);useEffect(()=>{api('/twin').then(setD)},[])
 if(!d)return <div className="loading">Loading digital twin…</div>
 return <><PageTitle title="Supply Chain Digital Twin" subtitle="Estimated and simulated network state"/><div className="grid-12"><article className="map-panel span-8"><div className="map-grid">{d.suppliers.slice(0,14).map((s,i)=> <button key={s.id} className={`map-node ${String(s.status).toLowerCase()}`} style={{left:`${8+(i%5)*19}%`,top:`${12+(Math.floor(i/5))*24}%`}} title={s.name}><span/><small>{s.code.replace('SUP-','')}</small></button>)}</div><div className="plant-node" style={{left:'64%',top:'68%'}}><MapPin size={18}/><span>CHKN-01</span></div></article><article className="panel span-4"><div className="panel-head"><b>Network health</b></div><div className="alerts">{d.suppliers.slice(0,8).map(s=><div className="alert" key={s.id}><div className={`alert-dot ${s.status==='CRITICAL'?'red':s.status==='WARNING'?'amber':'green'}`}/><div><b>{s.name}</b><span>{s.country} · risk {Math.round(s.riskScore)}</span></div></div>)}</div></article></div></>
}

function Sustainability(){
 const [d,setD]=useState(null);useEffect(()=>{api('/sustainability').then(setD)},[])
 if(!d)return <div className="loading">Loading sustainability…</div>
 return <><PageTitle title="Sustainability Intelligence" subtitle="Estimated CO2e — methodology, not verified carbon accounting"/><section className="kpis"><Kpi label="Estimated procurement CO2e" value={`${(d.totalCo2Kg/1000).toFixed(1)} t`} detail="Illustrative annual model" tone="green" icon={Leaf}/><Kpi label="CO2e per battery pack" value={`${d.co2PerPack} kg`} detail="Component-level estimate" tone="blue" icon={Activity}/><Kpi label="Domestic sourcing impact" value={`${(d.domesticCo2Kg/1000).toFixed(1)} t`} detail="Estimated footprint" tone="green" icon={MapPin}/><Kpi label="Transport estimate" value={`${(d.transportCo2Kg/1000).toFixed(1)} t`} detail="Air, sea and road" tone="amber" icon={Network}/></section><article className="panel table-panel"><table><thead><tr><th>Component</th><th>CO2e factor</th><th>Source classification</th></tr></thead><tbody>{d.methods.map(m=><tr key={m.component}><td><b>{m.component}</b></td><td>{m.co2PerUnit} kg/unit</td><td>{m.source}</td></tr>)}</tbody></table></article></>
}

function Scenarios(){
 const [d,setD]=useState(null),[strategy,setStrategy]=useState('BALANCED')
 async function compare(){setD(await api('/scenarios/compare',{method:'POST',body:JSON.stringify({demand:1000,tariffIncrease:35,strategy})}))}
 useEffect(()=>{compare()},[])
 if(!d)return <div className="loading">Comparing strategies…</div>
 const rows=[['Existing baseline',d.custom],['Cost optimized',d.costOptimized],['Domestic heavy',d.domesticHeavy],['Lowest risk',d.lowestRisk]]
 return <><PageTitle title="What-if Scenario Laboratory" subtitle="Compare sourcing strategies without violating business constraints" actions={<button className="primary" onClick={compare}><FlaskConical size={15}/>Recalculate</button>}/><article className="panel table-panel"><table><thead><tr><th>Strategy</th><th>Landed value</th><th>Estimated DVA</th><th>Inventory coverage</th><th>Allocation</th></tr></thead><tbody>{rows.map(([name,x])=><tr key={name}><td><b>{name}</b></td><td>₹{(x.totalValue/100000).toFixed(1)} lakh</td><td>{x.dva.toFixed(1)}%</td><td>{x.inventoryCoverage}%</td><td>{x.allocation.map(a=>a.supplierName).join(' + ')}</td></tr>)}</tbody></table></article></>
}

function Integrations(){
 const [rows,setRows]=useState([]);useEffect(()=>{api('/integrations').then(setRows)},[])
 return <><PageTitle title="Integration Center" subtitle="Backend adapters and clearly labeled connectivity state"/><article className="panel table-panel"><table><thead><tr><th>Integration</th><th>Adapter type</th><th>Status</th><th>Data freshness</th></tr></thead><tbody>{[...rows.map(r=>({name:r.name,kind:r.kind,status:r.status,freshness:r.freshness})),...['SAP S/4HANA','SAP Ariba','SAP IBP','SAP BTP','SAP Build','SAP Analytics Cloud'].filter(n=>!rows.some(r=>r.name===n)).map(n=>({name:n,kind:'SAP ADAPTER',status:n==='SAP BTP'?'NOT CONNECTED':'SIMULATED',freshness:'Local database'}))].map((r,i)=><tr key={i}><td><b>{r.name}</b></td><td>{r.kind}</td><td><span className={`status ${r.status==='NOT CONNECTED'?'high':''}`}>{r.status}</span></td><td>{r.freshness}</td></tr>)}</tbody></table></article></>
}

function Reports(){
 const types=['disruption-impact','procurement-optimization','pli-compliance','supplier-risk','sustainability','executive-incident-summary','audit-trail']
 return <><PageTitle title="Executive Reports" subtitle="Professional PDF exports with data-source classification"/><section className="report-grid">{types.map(t=><article className="report-card" key={t}><FileText size={22}/><div><b>{t.replace(/-/g,' ')}</b><span>PDF report</span></div><a href={`${API}/reports/${t}/pdf`} target="_blank"><Download size={16}/></a></article>)}</section></>
}

function Assistant(){
 const [q,setQ]=useState('Which supplier is most exposed to the current tariff shock?'),[answer,setAnswer]=useState(''),[loading,setLoading]=useState(false),[error,setError]=useState('')
 async function ask(){
  if(!q.trim()||loading) return
  setLoading(true);setError('')
  try{
   const r=await api('/assistant/query',{method:'POST',body:JSON.stringify({question:q})})
   setAnswer(r)
  }catch(e){
   setError('Unable to retrieve the database-grounded answer. Please try again.')
  }finally{
   setLoading(false)
  }
 }
 return <div className="assistant"><div className="assistant-head"><Sparkles size={18}/><b>Procurement Assistant</b><span>{loading?'Consulting records…':'Database-grounded fallback'}</span></div>{error&&<div className="answer"><p>{error}</p></div>}{answer&&!loading&&<div className="answer"><b>VoltGrid</b><p>{answer.answer||answer}</p>{answer.citations&&<small>Citations: {[...new Set(answer.citations)].join(', ')}</small>}</div>}<div className="assistant-input"><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&ask()} placeholder="Ask about incidents, suppliers or DVA"/><button onClick={ask} disabled={loading}>{loading?'Thinking…':'Ask'}</button></div></div>
}

export default function App(){
 const [user,setUser]=useState(()=>JSON.parse(localStorage.getItem('vg_user')||'null'))
 if(!user) return <Login onLogin={setUser}/>
 function logout(){localStorage.removeItem('vg_token');localStorage.removeItem('vg_user');setUser(null)}
 return <><Shell user={user} onLogout={logout}>
 <Routes>
  <Route path="/" element={<Dashboard/>}/><Route path="/suppliers" element={<Suppliers/>}/><Route path="/procurement" element={<Procurement/>}/><Route path="/agents" element={<Agents/>}/><Route path="/simulator" element={<Simulator/>}/><Route path="/approvals" element={<Approvals/>}/><Route path="/compliance" element={<Compliance/>}/><Route path="/audit" element={<Audit/>}/><Route path="/twin" element={<DigitalTwin/>}/><Route path="/sustainability" element={<Sustainability/>}/><Route path="/scenarios" element={<Scenarios/>}/><Route path="/integrations" element={<Integrations/>}/><Route path="/reports" element={<Reports/>}/>
  <Route path="/optimization" element={<Scenarios/>}/><Route path="/risk" element={<Generic title="Risk Intelligence" subtitle="Transparent weighted risk and evidence" items={['Tariff 25%','Inventory 25%','Concentration 15%','Geopolitical 15%','Logistics 10%','PLI 10%']}/>}/>
  <Route path="/disruptions" element={<Generic title="Disruption Intelligence" subtitle="Geopolitical and logistics signals" items={['GDELT adapter','News signals','Tariff verification','Port congestion']}/>}/>
  <Route path="/settings" element={<Generic title="Settings" subtitle="Organization, thresholds and demo environment" items={['PLI target 50%','Safe buffer 52%','Autonomous variance ₹5 lakh','LLM fallback enabled']}/>}/>
  <Route path="*" element={<Navigate to="/" replace/>}/>
 </Routes>
 </Shell><Assistant/></>
}
