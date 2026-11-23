import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import L from 'leaflet'
import { Activity, AlertTriangle, ArrowDownRight, Bot, CheckCircle2, CircleDollarSign, ClipboardCheck, Download, FileCheck2, FileText, FlaskConical, Gauge, LayoutDashboard, Menu, Network, PackageCheck, Play, RefreshCw, Settings, ShieldCheck, Split, TriangleAlert, Upload, Users, X } from 'lucide-react'
import { Bar, BarChart, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const API = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api'
const colors = ['#1769AA', '#16A6D9', '#26966B', '#E39A28', '#C94B42']
const MEERA = { id: 'meera-nair', name: 'Meera Nair', email: 'planner@voltgrid.ai', role: 'EV Sourcing Planner • Chakan Plant, Pune' }

async function api(path, options = {}) {
  const token = localStorage.getItem('vg_token')
  const headers = { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers }
  const response = await fetch(API + path, { ...options, headers })
  if (!response.ok) throw new Error(await response.text())
  return response.json()
}

const modules = [
  { title: 'Executive Control Tower', path: '/', icon: LayoutDashboard },
  { title: 'Digital Twin & Suppliers', path: '/digital-twin', icon: Network },
  { title: 'Disruption & Split-Order Lab', path: '/disruption-lab', icon: FlaskConical },
  { title: 'AI Agent Operations', path: '/agents', icon: Bot },
  { title: 'Risk & PLI Compliance', path: '/risk-compliance', icon: ShieldCheck },
  { title: 'Approval Center (HITL)', path: '/approvals', icon: ClipboardCheck },
  { title: 'SAP Extension & Audit', path: '/sap-audit', icon: FileCheck2 },
]

function Logo() {
  return <div className="brand"><svg viewBox="0 0 42 42" aria-label="VoltGrid logo"><rect x="5" y="7" width="32" height="28" rx="5" fill="#142C43"/><path d="M11 12h8v8h-8zm12 10h8v8h-8z" fill="#16A6D9"/><path d="M19 16h4v6h8M19 28h-4v-8" fill="none" stroke="#26966B" strokeWidth="2.5"/></svg><div><strong>VoltGrid</strong><span>AI CONTROL TOWER</span></div></div>
}

function Shell({ children }) {
  const [open, setOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sapMode, setSapMode] = useState('auto')
  const [settingsBusy, setSettingsBusy] = useState(false)
  const [settingsError, setSettingsError] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const current = modules.find(module => module.path === location.pathname) || modules[0]
  useEffect(() => {
    api('/sap/status').then(status => setSapMode(status.mode)).catch(error => setSettingsError(error.message))
  }, [])
  async function changeSapMode(mode) {
    setSettingsBusy(true); setSettingsError('')
    try {
      const status = await api('/sap/mode', { method: 'POST', body: JSON.stringify({ mode }) })
      setSapMode(status.mode)
      setSettingsError(status.auditWarning || '')
      window.dispatchEvent(new CustomEvent('sap-routing-mode-changed', { detail: status }))
    } catch (error) { setSettingsError(error.message) }
    finally { setSettingsBusy(false) }
  }
  return <div className="app-shell">
    <aside className={open ? 'open' : ''}><Logo/><nav aria-label="Grand Finale modules">{modules.map(({ title, path, icon: Icon }) => <button key={path} onClick={() => { navigate(path); setOpen(false) }} className={location.pathname === path ? 'active' : ''} aria-current={location.pathname === path ? 'page' : undefined}><Icon size={18}/><span>{title}</span></button>)}</nav></aside>
    {open && <button className="scrim" aria-label="Close navigation" onClick={() => setOpen(false)}/>}
    <div className="main"><header><button className="icon-button menu" aria-label="Open navigation" onClick={() => setOpen(true)}><Menu/></button><div className="module-heading"><span>VOLTGRID OPERATIONS</span><strong>{current.title}</strong></div><div className="header-actions"><div className="persona"><div>MN</div><span><b>Meera Nair</b><small>EV Sourcing Planner · Chakan</small></span><CheckCircle2 size={16}/></div><button className="icon-button" aria-label="Open settings" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(true)}><Settings size={17}/></button></div></header><main className="content">{children}</main></div>
    {settingsOpen && <div className="settings-layer"><button className="settings-backdrop" aria-label="Close settings" onClick={() => setSettingsOpen(false)}/><section className="settings-drawer" role="dialog" aria-modal="true" aria-labelledby="settings-title"><div className="settings-head"><div><span>WORKSPACE SETTINGS</span><h2 id="settings-title">SAP Data Routing</h2></div><button className="icon-button" aria-label="Close settings" onClick={() => setSettingsOpen(false)}><X size={17}/></button></div><p>Choose how VoltGrid reads and synchronizes SAP data. Local seeded records remain available as the automatic fallback.</p><div className="mode-options" role="group" aria-label="SAP Data Routing Mode"><button className={sapMode === 'auto' ? 'selected' : ''} aria-pressed={sapMode === 'auto'} disabled={settingsBusy} onClick={() => changeSapMode('auto')}><b>Auto</b><span>Live SAP → Local Fallback</span></button><button className={sapMode === 'fallback' ? 'selected' : ''} aria-pressed={sapMode === 'fallback'} disabled={settingsBusy} onClick={() => changeSapMode('fallback')}><b>Local Sandbox Only</b><span>Offline Safe</span></button></div>{settingsBusy && <small className="settings-note">Applying routing mode…</small>}{settingsError && <p className="settings-error" role="alert">{settingsError}</p>}<div className="settings-callout"><b>Approval safety</b><span>Split orders are always committed to the local database. SAP purchase-order writes require explicit server-side enablement.</span></div></section></div>}
  </div>
}

function PageTitle({ title, subtitle, actions }) {
  return <div className="page-title"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{actions && <div className="title-actions">{actions}</div>}</div>
}
function PanelTitle({ title, subtitle, action }) {
  return <div className="panel-head"><div><b>{title}</b>{subtitle && <span>{subtitle}</span>}</div>{action}</div>
}
function Loading({ label = 'Loading workspace…' }) { return <div className="loading">{label}</div> }
function ErrorMessage({ error, retry }) {
  if (!error) return null
  return <div className="error-banner" role="alert"><span>{error}</span>{retry && <button className="secondary" onClick={retry}>Retry</button>}</div>
}
function Kpi({ label, value, detail, tone = 'blue', icon: Icon }) {
  return <article className="kpi"><div className={`kpi-icon ${tone}`}><Icon size={19}/></div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>
}
function Status({ value }) { return <span className={`status ${String(value || '').toLowerCase()}`}>{value || 'N/A'}</span> }

function Dashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  async function load() { try { setData(await api('/dashboard')); setError('') } catch (e) { setError(e.message) } }
  useEffect(() => { load() }, [])
  async function startDemo() {
    try {
      const result = await api('/simulator/trigger', { method: 'POST', body: JSON.stringify({ title: '35% tariff shock — LFP prismatic cells', type: 'COMBINED', tariffIncrease: 35, delayDays: 21, inventoryLevel: 68, demand: 1200 }) })
      window.alert(`Grand Finale demo executed.\nIncident: ${result.incidentId}\nStatus: ${result.status}`)
      await load()
      if (result.status === 'AWAITING_APPROVAL') navigate('/approvals')
    } catch (e) { setError(e.message) }
  }
  if (!data) return <><PageTitle title="Executive Control Tower" subtitle="Chakan Plant · Live operating overview"/><ErrorMessage error={error} retry={load}/>{!error && <Loading/>}</>
  const k = data.kpis
  return <>
    <PageTitle title="Executive Control Tower" subtitle="Chakan Plant · Live operating overview" actions={<button className="primary" onClick={startDemo}><Play size={16}/>Activate Crisis Playbook</button>}/>
    <section className="kpis">
      <Kpi label="Annual procurement" value={`₹${(k.procurementValue / 10000000).toFixed(0)} Cr`} detail="Chakan plant annual value" icon={CircleDollarSign}/>
      <Kpi label="Supplier network" value={k.supplierCount} detail="Active suppliers" tone="green" icon={Users}/>
      <Kpi label="Overall risk" value={k.overallRisk} detail="Weighted current score" tone="amber" icon={Activity}/>
      <Kpi label="Domestic value" value={`${k.dva}%`} detail="DVA target 50%" tone="green" icon={ShieldCheck}/>
      <Kpi label="Inventory coverage" value={`${k.inventoryCoverage}%`} detail="Across critical BOM" icon={PackageCheck}/>
      <Kpi label="At-risk POs" value={k.atRiskPOs} detail={`₹${(k.financialExposure / 10000000).toFixed(1)} Cr exposed`} tone="red" icon={AlertTriangle}/>
    </section>
    <section className="grid-12">
      <article className="panel span-8"><PanelTitle title="Procurement spend by country" subtitle="Annualized · INR"/><div className="chart"><ResponsiveContainer><BarChart data={data.spendByCountry} margin={{ top: 20, right: 12, left: 8, bottom: 4 }}><XAxis dataKey="country"/><YAxis tickFormatter={value => `₹${(Number(value) / 10000000).toFixed(0)}Cr`}/><Tooltip formatter={value => [`₹${(Number(value) / 10000000).toFixed(2)} Cr`, 'Annualized spend']}/><Bar dataKey="value" fill="#1769AA" radius={[3, 3, 0, 0]}><LabelList dataKey="value" position="top" formatter={value => `₹${(Number(value) / 10000000).toFixed(1)}Cr`} fill="#1C2A38" fontSize={10}/></Bar></BarChart></ResponsiveContainer></div></article>
      <article className="panel span-4"><PanelTitle title="DVA composition" subtitle="Domestic and imported sourcing"/><div className="chart pie"><ResponsiveContainer><PieChart><Pie data={data.sourcing} dataKey="value" innerRadius={55} outerRadius={78} paddingAngle={2}>{data.sourcing.map((item, index) => <Cell key={item.name} fill={colors[index]}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer><div className="pie-center"><b>{k.dva}%</b><span>DVA</span></div></div></article>
      <article className="panel span-4"><PanelTitle title="Critical alerts" subtitle="Disruption signals"/><div className="alerts">{data.disruptions.slice(0, 4).map((item, index) => <div className="alert" key={item.id}><div className={`alert-dot ${index ? 'amber' : 'red'}`}/><div><b>{item.title}</b><span>{item.severity} · {item.source}</span></div></div>)}</div></article>
      <article className="panel span-4"><PanelTitle title="Agent execution feed" subtitle="Recent incident activity"/><div className="feed">{data.incidents.slice(0, 4).map(item => <div className="feed-row" key={item.id}><span className="feed-icon"><Bot size={15}/></span><div><b>{item.status}</b><span>{item.incidentId}</span></div></div>)}</div></article>
      <article className="panel span-4"><PanelTitle title="System integrations" subtitle="Adapter status"/><div className="integrations">{data.integrations.slice(0, 5).map(item => <div key={item.id}><span className="status-dot"/><b>{item.name}</b><small>{item.status}</small></div>)}</div></article>
    </section>
  </>
}

function DigitalTwin() {
  const [data, setData] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const mapRef = useRef(null)
  const instanceRef = useRef(null)
  const markerGroupRef = useRef(null)
  async function load() {
    try {
      const result = await api('/twin')
      setData(result)
      setSelectedId(current => current || result.suppliers[0]?.id || null)
    } catch (e) { setData({ error: e.message }) }
  }
  useEffect(() => { load() }, [])
  useEffect(() => {
    if (!data || data.error || !mapRef.current || instanceRef.current) return
    const map = L.map(mapRef.current, { scrollWheelZoom: false })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 18 }).addTo(map)
    instanceRef.current = map
    markerGroupRef.current = L.layerGroup().addTo(map)
    return () => { map.remove(); instanceRef.current = null; markerGroupRef.current = null }
  }, [data])
  useEffect(() => {
    if (!data || data.error || !instanceRef.current || !markerGroupRef.current) return
    const map = instanceRef.current
    const group = markerGroupRef.current
    group.clearLayers()
    const bounds = []
    data.suppliers.forEach(supplier => {
      if (!Number.isFinite(supplier.latitude) || !Number.isFinite(supplier.longitude)) return
      const point = [supplier.latitude, supplier.longitude]
      bounds.push(point)
      const marker = L.circleMarker(point, {
        radius: supplier.id === selectedId ? 10 : 7,
        color: supplier.id === selectedId ? '#142C43' : '#FFFFFF',
        weight: supplier.id === selectedId ? 3 : 2,
        fillColor: supplier.status === 'CRITICAL' ? '#C94B42' : supplier.status === 'WARNING' ? '#E39A28' : '#26966B',
        fillOpacity: 0.95,
      }).bindTooltip(`${supplier.name} · risk ${Math.round(supplier.riskScore)}`)
      marker.on('click', () => setSelectedId(supplier.id))
      group.addLayer(marker)
    })
    if (data.plant) {
      const plantPoint = [data.plant.latitude, data.plant.longitude]
      bounds.push(plantPoint)
      L.marker(plantPoint).bindTooltip(`${data.plant.name} · Chakan plant`).addTo(group)
    }
    if (bounds.length) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 5 })
  }, [data, selectedId])
  if (!data) return <><PageTitle title="Digital Twin & Suppliers" subtitle="Live network health · Chakan plant"/><Loading/></>
  if (data.error) return <><PageTitle title="Digital Twin & Suppliers" subtitle="Live network health · Chakan plant"/><ErrorMessage error={data.error} retry={load}/></>
  const selected = data.suppliers.find(supplier => supplier.id === selectedId)
  return <>
    <PageTitle title="Digital Twin & Suppliers" subtitle={`${data.suppliers.length} suppliers · Chakan plant · map/table selection stays in sync`}/>
    <div className="twin-layout">
      <article className="panel twin-map-panel"><PanelTitle title="Global supplier network" subtitle="Select a marker or supplier row"/><div ref={mapRef} className="leaflet-map" aria-label="Supplier network map"/></article>
      <article className="panel supplier-detail"><PanelTitle title="Selected supplier" subtitle={selected?.code || 'Select a supplier'}/>{selected ? <div className="supplier-summary"><h2>{selected.name}</h2><p>{selected.city}, {selected.country}</p><div className="supplier-metrics"><span>Risk score <b>{Math.round(selected.riskScore)}</b></span><span>Quality <b>{selected.qualityScore}%</b></span><span>Reliability <b>{selected.reliability}%</b></span><span>Lead time <b>{selected.leadTimeDays} days</b></span></div><Status value={selected.status}/><span className={`dva-tag ${selected.dvaEligible ? 'eligible' : 'ineligible'}`}>{selected.dvaEligible ? 'DVA eligible' : 'Not DVA eligible'} · {selected.domestic ? 'Domestic' : 'International'}</span></div> : <div className="empty-small">No suppliers available.</div>}</article>
    </div>
    <article className="panel table-panel supplier-table-panel"><PanelTitle title="Supplier directory" subtitle={`${data.suppliers.length} active supplier records`}/><table><thead><tr><th>Supplier</th><th>Country</th><th>Origin / DVA</th><th>Quality</th><th>Reliability</th><th>Lead time</th><th>Risk</th><th>Status</th></tr></thead><tbody>{data.suppliers.map(supplier => <tr key={supplier.id} className={supplier.id === selectedId ? 'selected-row' : ''} onClick={() => setSelectedId(supplier.id)} aria-selected={supplier.id === selectedId}><td><b>{supplier.name}</b><small>{supplier.code}</small></td><td>{supplier.country}</td><td>{supplier.domestic ? 'Domestic' : 'International'} · {supplier.dvaEligible ? 'Eligible' : 'Not eligible'}</td><td>{supplier.qualityScore}%</td><td>{supplier.reliability}%</td><td>{supplier.leadTimeDays} days</td><td>{Math.round(supplier.riskScore)}</td><td><Status value={supplier.status}/></td></tr>)}</tbody></table></article>
  </>
}

const disruptionTabs = ['Scenario Lab', 'Documents & Verification', 'Strategy Comparison']
function DisruptionLab() {
  const [tab, setTab] = useState(disruptionTabs[0])
  const [params, setParams] = useState({ tariffIncrease: 35, delayDays: 14, currencyDepreciation: 4, supplierCapacityReduction: 20, inventoryLevel: 68, demand: 1000 })
  const [execution, setExecution] = useState(null)
  const [scenario, setScenario] = useState(null)
  const [strategy, setStrategy] = useState('BALANCED')
  const [document, setDocument] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function trigger(preset = {}) {
    setBusy(true); setError('')
    try {
      const result = await api('/simulator/trigger', { method: 'POST', body: JSON.stringify({ ...params, ...preset, type: preset.type || 'COMBINED', title: preset.title || 'Custom disruption scenario' }) })
      setExecution(result)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  async function compare() {
    setBusy(true); setError('')
    try {
      const payload = { demand: params.demand, tariffIncrease: params.tariffIncrease, inventoryLevel: params.inventoryLevel }
      const [baseline, custom] = await Promise.all([
        api('/scenarios/compare', { method: 'POST', body: JSON.stringify({ ...payload, strategy: 'BALANCED' }) }),
        strategy === 'BALANCED' ? Promise.resolve(null) : api('/scenarios/compare', { method: 'POST', body: JSON.stringify({ ...payload, strategy }) }),
      ])
      setScenario({ ...baseline, custom: custom?.custom || baseline.custom })
    }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  async function uploadFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setBusy(true); setError(''); setDocument(null)
    try {
      const body = new FormData()
      body.append('document', file)
      setDocument(await api('/documents/upload', { method: 'POST', body }))
    } catch (e) { setError(e.message) } finally { setBusy(false); event.target.value = '' }
  }
  async function verifyDocument() {
    if (!document) return
    setBusy(true); setError('')
    try { setDocument(await api(`/documents/${document.id}/verify`, { method: 'POST', body: JSON.stringify({}) })) }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  async function reset() {
    setBusy(true); setError('')
    try { await api('/simulator/reset', { method: 'POST', body: JSON.stringify({}) }); setExecution(null) }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const scenarios = [
    { label: 'Tariff shock · 35%', values: { title: '35% tariff shock — LFP cells', type: 'TARIFF', tariffIncrease: 35 } },
    { label: 'Port delay · 21 days', values: { title: 'Port congestion — 21 day delay', type: 'PORT', delayDays: 21 } },
    { label: 'Combined supply shock', values: { title: 'Combined tariff and logistics shock', type: 'COMBINED', tariffIncrease: 35, delayDays: 21, inventoryLevel: 68 } },
  ]
  const fields = [['tariffIncrease', 'Tariff increase (%)', 100], ['delayDays', 'Logistics delay (days)', 60], ['currencyDepreciation', 'INR depreciation (%)', 100], ['supplierCapacityReduction', 'Supplier capacity reduction (%)', 100], ['inventoryLevel', 'Inventory level (%)', 100], ['demand', 'Production demand (units)', 5000]]
  return <>
    <PageTitle title="Disruption & Split-Order Lab" subtitle="Model supply shocks, verify source documents, and compare resilient allocations"/>
    <div className="tabs" role="tablist">{disruptionTabs.map(name => <button key={name} role="tab" aria-selected={tab === name} className={tab === name ? 'active' : ''} onClick={() => setTab(name)}>{name}</button>)}</div>
    <ErrorMessage error={error}/>
    {tab === disruptionTabs[0] && <>
      <section className="preset-row">{scenarios.map(preset => <button className="secondary" key={preset.label} disabled={busy} onClick={() => trigger(preset.values)}><AlertTriangle size={15}/>{preset.label}</button>)}</section>
      <div className="grid-12"><article className="panel span-4"><PanelTitle title="Custom shock parameters" subtitle="Adjust values, then run the scenario"/><div className="controls">{fields.map(([key, label, max]) => <label key={key}><span>{label}<b>{params[key]}</b></span><input type="range" min="0" max={max} value={params[key]} onChange={event => setParams({ ...params, [key]: Number(event.target.value) })}/></label>)}</div><div className="panel-actions"><button className="secondary" disabled={busy} onClick={reset}><RefreshCw size={15}/>Reset scenario</button><button className="primary" disabled={busy} onClick={() => trigger()}><Play size={15}/>{busy ? 'Running…' : 'Run VoltRoute split'}</button></div></article>
        <article className="panel span-8"><PanelTitle title="Orchestration & proposed split" subtitle={execution ? `${execution.incidentId} · ${execution.status}` : 'VoltSense → Risk → VoltRoute → VoltGuard'}/>{execution ? <><div className="timeline">{(execution.agentExecutions || []).map((item, index) => <div key={item.id}><span>{index + 1}</span><div><b>{item.agentName}</b><small>{item.status} · {item.durationMs} ms</small></div></div>)}</div><div className="table-panel"><table><thead><tr><th>Supplier</th><th>Quantity</th><th>Landed cost</th><th>Lead time</th></tr></thead><tbody>{(execution.allocations || []).map(item => <tr key={item.id}><td><b>{item.supplier?.name || item.supplierId}</b></td><td>{item.quantity}</td><td>₹{Number(item.landedCost).toLocaleString('en-IN')}</td><td>{item.delayDays} days</td></tr>)}</tbody></table></div></> : <div className="empty-small">Choose a preset shock or adjust parameters to run the agent workflow.</div>}</article>
      </div>
    </>}
    {tab === disruptionTabs[1] && <article className="panel document-panel"><PanelTitle title="Circular & source document verification" subtitle="Upload a PDF or CSV for Meera Nair's verification step"/><div className="upload-area"><Upload size={24}/><b>Select a PDF or CSV file</b><span>Maximum upload size follows the backend's 10 MB limit.</span><label className="primary upload-button">Choose file<input type="file" accept=".pdf,.csv,application/pdf,text/csv" onChange={uploadFile}/></label></div>{document && <div className="document-result"><div><FileText size={20}/><span><b>{document.fileName}</b><small>{document.mimeType} · {document.extractedText}</small></span></div>{document.verified ? <Status value="VERIFIED"/> : <button className="primary" disabled={busy} onClick={verifyDocument}><CheckCircle2 size={15}/>Meera Nair · Verify document</button>}</div>}</article>}
    {tab === disruptionTabs[2] && <><article className="panel strategy-controls"><PanelTitle title="What-if strategy comparison" subtitle="Baseline, cost optimized, domestic heavy, and custom allocation"/><div className="strategy-form"><label>Custom strategy<select value={strategy} onChange={event => setStrategy(event.target.value)}><option value="BALANCED">Balanced</option><option value="COST">Cost optimized</option><option value="DOMESTIC">Domestic heavy</option><option value="LOW_RISK">Lowest risk</option></select></label><button className="primary" disabled={busy} onClick={compare}><RefreshCw size={15}/>{busy ? 'Comparing…' : 'Compare strategies'}</button></div></article>{scenario && <article className="panel table-panel strategy-table"><table><thead><tr><th>Strategy</th><th>Landed value</th><th>Estimated DVA</th><th>Inventory coverage</th><th>Split allocation</th></tr></thead><tbody>{[['Baseline', scenario.custom], ['Cost-Optimized', scenario.costOptimized], ['Domestic-Heavy', scenario.domesticHeavy], ['Custom', scenario.custom]].map(([name, result]) => <tr key={name}><td><b>{name}</b></td><td>₹{Number(result.totalValue).toLocaleString('en-IN')}</td><td>{Number(result.dva).toFixed(1)}%</td><td>{result.inventoryCoverage}%</td><td>{result.allocation.map(allocation => allocation.supplierName).join(' + ')}</td></tr>)}</tbody></table></article>}</>}
  </>
}

function Agents() {
  const [incidents, setIncidents] = useState([])
  const [error, setError] = useState('')
  async function load() { try { setIncidents(await api('/incidents')); setError('') } catch (e) { setError(e.message) } }
  async function run() {
    setError('')
    try {
      const result = await api('/simulator/trigger', { method: 'POST', body: JSON.stringify({ title: 'Agent orchestration review', type: 'TARIFF', tariffIncrease: 35, delayDays: 14, inventoryLevel: 72, demand: 1000 }) })
      setIncidents(current => [result, ...current])
    } catch (e) { setError(e.message) }
  }
  useEffect(() => { load() }, [])
  return <>
    <PageTitle title="AI Agent Operations" subtitle="VOLTSENSE · VOLTROUTE · VOLTGUARD orchestration" actions={<button className="primary" onClick={run}><Play size={16}/>Run orchestration</button>}/>
    <ErrorMessage error={error} retry={load}/>
    <section className="agent-grid">{[['VOLTSENSE', 'Disruption sensing', 'Policy, tariff and logistics exposure detection', TriangleAlert], ['VOLTROUTE', 'Supplier optimization', 'Constrained landed-cost and risk allocation', Split], ['VOLTGUARD', 'PLI compliance', 'Domestic value and procurement safeguards', ShieldCheck]].map(([name, subtitle, description, Icon], index) => <article className="agent-card" key={name}><div className="agent-head"><span className={`agent-icon a${index}`}><Icon/></span><div><b>{name}</b><small>{subtitle}</small></div><Status value="READY"/></div><p>{description}</p><div className="agent-stat"><span>Orchestrated during each disruption run</span><b>Active</b></div></article>)}</section>
    <article className="panel table-panel incident-history"><PanelTitle title="Incident execution history" subtitle={`${incidents.length} recorded incidents`}/><table><thead><tr><th>Incident</th><th>Title</th><th>Status</th><th>Agent steps</th><th>Started</th></tr></thead><tbody>{incidents.map(incident => <tr key={incident.id}><td><b>{incident.incidentId}</b></td><td>{incident.title}</td><td><Status value={incident.status}/></td><td>{incident.agentExecutions?.map(item => item.agentName).join(' → ') || 'Not run'}</td><td>{new Date(incident.createdAt).toLocaleString()}</td></tr>)}</tbody></table></article>
  </>
}

const riskFactors = [
  ['tariffExposure', 'Tariff exposure'], ['inventoryStockout', 'Inventory & stockout'], ['supplierConcentration', 'Supplier concentration'],
  ['geopoliticalExposure', 'Geopolitical exposure'], ['logisticsDelay', 'Logistics delay'], ['pliCompliance', 'PLI / DVA exposure'],
]
function RiskCompliance() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [aiExplanation, setAiExplanation] = useState(null)
  const [aiError, setAiError] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  async function load() {
    try {
      const [compliance, incidents] = await Promise.all([api('/compliance'), api('/incidents')])
      setData({ compliance, incidents }); setError('')
    } catch (e) { setError(e.message) }
  }
  useEffect(() => { load() }, [])
  if (!data) return <><PageTitle title="Risk & PLI Compliance" subtitle="Weighted risk, domestic value safeguards, and evidence"/><ErrorMessage error={error} retry={load}/>{!error && <Loading/>}</>
  const currentRisk = data.incidents.find(incident => incident.riskAssessments?.length)?.riskAssessments?.[0]
  const breakdown = currentRisk ? JSON.parse(currentRisk.breakdownJson) : null
  const dva = Number(data.compliance.currentDva)
  const dvaStatus = dva > 52 ? 'SAFE' : dva >= 50 ? 'WARNING' : 'CRITICAL'
  async function explainRisk() {
    setAiLoading(true); setAiError('')
    try {
      const response = await api('/assistant/query', {
        method: 'POST',
        body: JSON.stringify({ question: `Explain the latest Chakan plant risk and PLI status. Current DVA is ${dva.toFixed(1)}% with a 50% target and 52% safe buffer. Include the latest weighted risk and stockout estimate if available.` }),
      })
      setAiExplanation(response)
    } catch (e) { setAiError(e.message) } finally { setAiLoading(false) }
  }
  return <>
    <PageTitle title="Risk & PLI Compliance" subtitle="Six-factor risk model · illustrative DVA assessment"/>
    <section className="kpis risk-kpis"><Kpi label="Weighted risk" value={currentRisk ? `${currentRisk.overallRisk}/100` : '—'} detail={currentRisk ? 'Latest incident assessment' : 'Run a disruption scenario'} tone="amber" icon={Activity}/><Kpi label="Stockout probability" value={currentRisk ? `${currentRisk.stockoutProbability}%` : '—'} detail="Latest completed incident" tone="red" icon={PackageCheck}/><Kpi label="Financial exposure" value={currentRisk ? `₹${(currentRisk.financialExposure / 100000).toFixed(1)}L` : '—'} detail="Scenario estimate" tone="blue" icon={CircleDollarSign}/><Kpi label="Domestic value" value={`${dva.toFixed(1)}%`} detail={`Target ${data.compliance.target}% · safe above 52%`} tone={dvaStatus === 'SAFE' ? 'green' : dvaStatus === 'WARNING' ? 'amber' : 'red'} icon={Gauge}/></section>
    <section className="grid-12"><article className="panel span-7 risk-breakdown"><PanelTitle title="Weighted risk breakdown" subtitle={currentRisk ? currentRisk.explanation : 'Weights total 100% · run a disruption to produce a grounded assessment'}/>{breakdown ? <div className="risk-factors">{riskFactors.map(([key, label]) => { const factor = breakdown[key]; return <div className="risk-factor" key={key}><div><b>{label}</b><span>{factor.score}/100 · {factor.weight}% weight · {factor.contribution.toFixed(1)} contribution</span></div><div className="risk-bar"><i style={{ width: `${factor.score}%` }}/></div></div> })}</div> : <div className="risk-factors">{[['Tariff exposure', 25], ['Inventory & stockout', 25], ['Supplier concentration', 15], ['Geopolitical exposure', 15], ['Logistics delay', 10], ['PLI / DVA exposure', 10]].map(([label, weight]) => <div className="risk-factor" key={label}><div><b>{label}</b><span>{weight}% model weight</span></div></div>)}</div>}</article>
      <article className="panel span-5 dva-card"><PanelTitle title="Live DVA gauge" subtitle={`Prototype threshold ${data.compliance.target}% · safe buffer ${data.compliance.safeBuffer}%`}/><div className={`dva-gauge ${dvaStatus.toLowerCase()}`}><div><strong>{dva.toFixed(1)}%</strong><span>DVA</span></div></div><Status value={dvaStatus}/><p>{dva > 52 ? 'Above 52% safe buffer.' : dva >= 50 ? 'At or above threshold but below the safe buffer; review before execution.' : 'Below the 50% threshold; procurement recommendation requires review.'}</p><div className="grounded-note"><CheckCircle2 size={16}/><span><b>Database-grounded explanation</b><small>{currentRisk ? currentRisk.explanation : `No completed risk record yet. Current DVA ${dva.toFixed(1)}% is read from the latest compliance assessment or prototype baseline.`} Values are estimates, not verified legal advice.</small></span></div><button className="secondary ai-explain-button" disabled={aiLoading} onClick={explainRisk}><Bot size={15}/>{aiLoading ? 'Generating…' : 'Generate provider explanation'}</button>{aiError && <p className="provider-error" role="alert">{aiError}</p>}{aiExplanation && <div className="provider-answer"><b>{aiExplanation.source}</b><p>{aiExplanation.answer}</p>{aiExplanation.citations?.length > 0 && <small>Records: {aiExplanation.citations.join(', ')}</small>}</div>}</article>
    </section>
    <article className="panel table-panel eligibility-table"><PanelTitle title="Explicit supplier DVA eligibility" subtitle={`${data.compliance.suppliers.length} eligible supplier records from the current DVA API`}/><table><thead><tr><th>Supplier</th><th>Country</th><th>Domestic</th><th>DVA eligibility</th><th>Quality</th><th>Reliability</th></tr></thead><tbody>{data.compliance.suppliers.map(supplier => <tr key={supplier.id}><td><b>{supplier.name}</b><small>{supplier.code}</small></td><td>{supplier.country}</td><td>{supplier.domestic ? 'Yes' : 'No'}</td><td><span className="dva-tag eligible">Eligible</span></td><td>{supplier.qualityScore}%</td><td>{supplier.reliability}%</td></tr>)}</tbody></table></article>
  </>
}

function ApprovalCenter() {
  const [approvals, setApprovals] = useState([])
  const [orders, setOrders] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  async function load() {
    try {
      const [approvalRows, poRows, supplierRows] = await Promise.all([api('/approvals'), api('/procurement/orders'), api('/suppliers')])
      setApprovals(approvalRows); setOrders(poRows); setSuppliers(supplierRows); setError('')
    } catch (e) { setError(e.message) }
  }
  useEffect(() => { load() }, [])
  async function decide(id, action) {
    setBusyId(id); setError('')
    try { await api(`/approvals/${id}/${action}`, { method: 'POST', body: JSON.stringify({ note: `${action === 'approve' ? 'Approved' : action === 'reject' ? 'Rejected' : 'Revision requested'} by Meera Nair` }) }); await load() }
    catch (e) { setError(e.message) } finally { setBusyId(null) }
  }
  const supplierById = useMemo(() => new Map(suppliers.map(supplier => [supplier.id, supplier])), [suppliers])
  if (!approvals.length && error) return <><PageTitle title="Approval Center (HITL)" subtitle="Meera Nair · direct approval authority"/><ErrorMessage error={error} retry={load}/></>
  return <>
    <PageTitle title="Approval Center (HITL)" subtitle="Meera Nair · affected POs, before/after split, and direct governance actions"/>
    <ErrorMessage error={error} retry={load}/>
    {!approvals.length ? <div className="panel empty-state"><ClipboardCheck size={28}/><h3>No escalations awaiting review</h3><p>New scenarios requiring human governance will appear here.</p></div> : <div className="approval-list">{approvals.map(approval => {
      const incident = approval.incident || {}
      const allocations = incident.allocations || []
      const allocationSupplierIds = new Set(allocations.map(allocation => allocation.supplierId))
      const affectedOrders = orders.filter(order => (incident.poId && order.id === incident.poId) || allocationSupplierIds.has(order.supplierId) || (order.status === 'AT_RISK' && !allocationSupplierIds.size))
      const beforeValue = affectedOrders.reduce((sum, order) => sum + Number(order.totalValue), 0)
      const afterValue = allocations.reduce((sum, allocation) => sum + Number(allocation.landedCost), 0)
      const beforeDvaBase = orders.reduce((sum, order) => sum + (order.supplier?.domestic ? Number(order.totalValue) : 0), 0)
      const totalOrderValue = orders.reduce((sum, order) => sum + Number(order.totalValue), 0)
      const beforeDva = totalOrderValue ? beforeDvaBase / totalOrderValue * 100 : 0
      const compliance = incident.complianceAssessments?.[0]
      const afterDva = Number(compliance?.dva ?? beforeDva)
      const beforeRisk = affectedOrders.length ? affectedOrders.reduce((sum, order) => sum + Number(order.supplier?.riskScore || 0), 0) / affectedOrders.length : null
      const proposedSuppliers = allocations.map(allocation => supplierById.get(allocation.supplierId)).filter(Boolean)
      const afterRisk = proposedSuppliers.length ? proposedSuppliers.reduce((sum, supplier) => sum + Number(supplier.riskScore), 0) / proposedSuppliers.length : null
      const riskReduction = beforeRisk != null && afterRisk != null ? beforeRisk - afterRisk : null
      const risk = incident.riskAssessments?.[0]
      const isPending = approval.status === 'PENDING'
      return <article className="approval-card" key={approval.id}>
        <div className="approval-top"><div><span className="incident-tag">{incident.incidentId}</span><b>{incident.title}</b></div><Status value={approval.status}/></div>
        <div className="approval-metrics"><div><span>Financial delta</span><b>{afterValue - beforeValue >= 0 ? '+' : '−'}₹{(Math.abs(afterValue - beforeValue) / 100000).toFixed(1)} lakh</b><small>Proposed split vs affected POs</small></div><div><span>DVA impact</span><b>{afterDva.toFixed(1)}% <small>({afterDva - beforeDva >= 0 ? '+' : ''}{(afterDva - beforeDva).toFixed(1)} pts)</small></b><small>Baseline {beforeDva.toFixed(1)}% · proposed</small></div><div><span>Estimated risk reduction</span><b>{riskReduction == null ? '—' : `${riskReduction >= 0 ? '−' : '+'}${Math.abs(riskReduction).toFixed(1)} pts`}</b><small>{risk ? `Incident score ${risk.overallRisk}/100` : 'Supplier-risk comparison'}</small></div><div><span>VoltGuard verdict</span><b><Status value={compliance?.result || (afterDva > 52 ? 'SAFE' : afterDva >= 50 ? 'WARNING' : 'CRITICAL')}/></b><small>DVA threshold 50% · safe buffer 52%</small></div></div>
        <div className="po-comparison"><div className="comparison-column"><h3>Before · existing POs for proposed suppliers</h3><p className="comparison-caption">Matched by supplier; incidents do not currently expose a direct PO link.</p>{affectedOrders.length ? affectedOrders.map(order => <div className="comparison-item" key={order.id}><div><b>{order.poNumber}</b><small>{order.supplier?.name} · {order.status}</small></div><strong>₹{Number(order.totalValue).toLocaleString('en-IN')}</strong></div>) : <p className="muted">No matching existing PO is available for this incident.</p>}</div><div className="comparison-arrow"><ArrowDownRight size={20}/></div><div className="comparison-column"><h3>After · proposed split order</h3>{allocations.length ? allocations.map(allocation => <div className="comparison-item" key={allocation.id}><div><b>{allocation.supplier?.name || supplierById.get(allocation.supplierId)?.name || 'Proposed supplier'}</b><small>{allocation.quantity} units · {allocation.delayDays} day lead time</small></div><strong>₹{Number(allocation.landedCost).toLocaleString('en-IN')}</strong></div>) : <p className="muted">No proposed allocation is attached to this escalation.</p>}</div></div>
        {isPending && <div className="approval-actions"><button className="danger-secondary" disabled={busyId === approval.id} onClick={() => decide(approval.id, 'reject')}><X size={15}/>Reject</button><button className="secondary" disabled={busyId === approval.id} onClick={() => decide(approval.id, 'revise')}><RefreshCw size={15}/>Request Revision</button><button className="primary" disabled={busyId === approval.id} onClick={() => decide(approval.id, 'approve')}><CheckCircle2 size={15}/>{busyId === approval.id ? 'Recording…' : 'Approve & execute ERP'}</button></div>}
      </article>
    })}</div>}
  </>
}

function SapAudit() {
  const [status, setStatus] = useState(null)
  const [logs, setLogs] = useState([])
  const [error, setError] = useState('')
  const [testing, setTesting] = useState(false)
  async function load() {
    try {
      const [sapStatus, auditRows] = await Promise.all([api('/sap/status'), api('/audit')])
      setStatus(sapStatus); setLogs(auditRows); setError('')
    } catch (e) { setError(e.message) }
  }
  useEffect(() => { load() }, [])
  useEffect(() => {
    const updateStatus = event => setStatus(event.detail)
    window.addEventListener('sap-routing-mode-changed', updateStatus)
    return () => window.removeEventListener('sap-routing-mode-changed', updateStatus)
  }, [])
  async function testConnection() {
    setTesting(true); setError('')
    try { setStatus(await api('/sap/test-connection', { method: 'POST', body: JSON.stringify({}) })) }
    catch (e) { setError(e.message) }
    finally { setTesting(false) }
  }
  const lastApprovalPayload = status?.lastApprovalPayload
  return <>
    <PageTitle title="SAP Extension & Audit" subtitle="Side-by-side SAP extension · live-first routing with local fallback" actions={<button className="primary" disabled={testing} onClick={testConnection}><RefreshCw size={15}/>{testing ? 'Testing…' : 'Test SAP Live Connection'}</button>}/>
    <ErrorMessage error={error} retry={load}/>
    <section className="sap-system-grid">{(status?.systems || []).map(system => <article className="panel sap-system-card" key={system.system}><div><span className="sap-system-name">{system.name}</span><span className={`sap-source-pill ${system.source === 'SAP_LIVE' ? 'live' : 'fallback'}`}>{system.source === 'SAP_LIVE' ? `Live SAP Connected (${system.lastLatencyMs ?? 0}ms)` : 'Auto-Fallback: Local Sandbox'}</span></div><small>{system.configured ? 'Endpoint and credentials configured' : 'Using local seed data; live endpoint credentials are not configured'}</small>{system.lastFallbackReason && <small className="sap-reason">{system.lastFallbackReason}</small>}{system.lastChecked && <small>Checked {new Date(system.lastChecked).toLocaleString()}</small>}</article>)}</section>
    <details className="panel sap-payload-viewer"><summary>Inspect Live SAP OData/JSON Payload</summary><div className="sap-payload-content"><p>Exact OData entity-set and request bodies generated for Meera Nair’s most recent approval.</p><pre>{lastApprovalPayload ? JSON.stringify(lastApprovalPayload, null, 2) : 'No approval payload has been generated in this backend session yet.'}</pre></div></details>
    <section className="audit-toolbar"><div><h2>Governance audit log</h2><p>Operational actions are recorded with Meera Nair as the active workspace actor.</p></div><div><a className="secondary" href={`${API}/audit/export`} target="_blank" rel="noreferrer"><Download size={15}/>Export CSV</a><a className="primary" href={`${API}/reports/executive-incident-summary/pdf`} target="_blank" rel="noreferrer"><FileText size={15}/>Flagship incident PDF</a></div></section>
    <article className="panel table-panel audit-table"><table><thead><tr><th>Timestamp</th><th>Action</th><th>Entity</th><th>Actor</th><th>Details</th></tr></thead><tbody>{logs.map(log => <tr key={log.id}><td>{new Date(log.createdAt).toLocaleString()}</td><td><b>{log.action}</b></td><td>{log.entityType}</td><td>{log.actor}</td><td className="detail-cell">{log.detailsJson}</td></tr>)}</tbody></table></article>
  </>
}

const legacyRedirects = [
  ['/login', '/'], ['/twin', '/digital-twin'], ['/suppliers', '/digital-twin'],
  ['/simulator', '/disruption-lab'], ['/disruptions', '/disruption-lab'], ['/optimization', '/disruption-lab'], ['/scenarios', '/disruption-lab'],
  ['/risk', '/risk-compliance'], ['/compliance', '/risk-compliance'], ['/procurement', '/approvals'], ['/sustainability', '/risk-compliance'],
  ['/integrations', '/sap-audit'], ['/audit', '/sap-audit'], ['/reports', '/sap-audit'], ['/settings', '/'],
]

function App() {
  const [authState, setAuthState] = useState('loading')
  const [authError, setAuthError] = useState('')
  async function authenticate() {
    setAuthState('loading'); setAuthError('')
    try {
      const result = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: MEERA.email, password: 'VoltGrid!2026' }) })
      localStorage.setItem('vg_token', result.token)
      localStorage.setItem('vg_user', JSON.stringify(result.user))
      setAuthState('ready')
    } catch (error) {
      setAuthError(`Meera Nair could not be authenticated against the seeded demo account: ${error.message}`)
      setAuthState('failed')
    }
  }
  useEffect(() => { authenticate() }, [])
  if (authState === 'loading') return <div className="auth-loading"><Logo/><Loading label="Opening VoltGrid as Meera Nair…"/></div>
  if (authState === 'failed') return <div className="auth-loading"><Logo/><ErrorMessage error={authError} retry={authenticate}/></div>
  return <Shell><Routes>
    <Route path="/" element={<Dashboard/>}/>
    <Route path="/digital-twin" element={<DigitalTwin/>}/>
    <Route path="/disruption-lab" element={<DisruptionLab/>}/>
    <Route path="/agents" element={<Agents/>}/>
    <Route path="/risk-compliance" element={<RiskCompliance/>}/>
    <Route path="/approvals" element={<ApprovalCenter/>}/>
    <Route path="/sap-audit" element={<SapAudit/>}/>
    {legacyRedirects.map(([from, to]) => <Route key={from} path={from} element={<Navigate to={to} replace/>}/>)}
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes></Shell>
}

export default App
