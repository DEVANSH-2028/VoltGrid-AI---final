import { prisma } from '../../db/prisma.js'
import {
  getSapConfig,
  getSapSystemConfiguration,
  isSapSystemConfigured,
  setRuntimeSapMode,
} from './sapConfig.js'
import * as s4hanaAdapter from './adapters/s4hanaAdapter.js'
import * as aribaAdapter from './adapters/aribaAdapter.js'
import * as ibpAdapter from './adapters/ibpAdapter.js'
import * as buildProcessAdapter from './adapters/buildProcessAdapter.js'
import { getBOM, getInventory, getPurchaseOrders, getSuppliers } from './fallbackStore.js'
import {
  buildS4HanaPurchaseOrderPayload,
  normalizeBOM,
  normalizeInventory,
  normalizePurchaseOrders,
  normalizeSuppliers,
  unwrapODataCollection,
} from './sapMappers.js'

const SYSTEMS = [
  ['SAP_S4HANA', 'SAP S/4HANA'],
  ['SAP_ARIBA', 'SAP Ariba'],
  ['SAP_IBP', 'SAP IBP'],
  ['SAP_BTP_RUNTIME', 'SAP BTP Runtime'],
  ['SAP_BUILD_PROCESS', 'SAP Build Process Automation'],
]
const telemetry = new Map(SYSTEMS.map(([system]) => [system, {
  lastChecked: null,
  activeSource: 'LOCAL_FALLBACK',
  lastLatencyMs: null,
  lastPayload: null,
  lastFallbackReason: null,
}]))
let lastApprovalPayload = null

function isUsableData(data) {
  if (Array.isArray(data)) return data.length > 0
  if (!data || typeof data !== 'object') return false
  const rows = unwrapODataCollection(data)
  if (rows) return rows.length > 0
  return Object.keys(data).length > 0
}

function updateTelemetry(systemName, { source, latencyMs, payload, fallbackReason }) {
  const current = telemetry.get(systemName) || {}
  telemetry.set(systemName, {
    ...current,
    lastChecked: new Date().toISOString(),
    activeSource: source,
    lastLatencyMs: Number.isFinite(latencyMs) ? latencyMs : null,
    lastPayload: payload === undefined ? current.lastPayload : payload,
    lastFallbackReason: fallbackReason || null,
  })
}

export async function executeWithFallback(systemName, liveFn, fallbackFn) {
  const config = getSapConfig()
  const startedAt = Date.now()
  let liveResult = null
  const fallbackReason = config.mode === 'fallback'
    ? 'Local sandbox mode selected.'
    : !isSapSystemConfigured(systemName, config)
      ? 'SAP credentials or endpoint configuration are missing.'
      : null

  if (fallbackReason) {
    const data = await fallbackFn()
    const latencyMs = Date.now() - startedAt
    updateTelemetry(systemName, { source: 'LOCAL_FALLBACK', latencyMs, fallbackReason })
    return {
      data,
      meta: { source: 'LOCAL_FALLBACK', system: systemName, mode: config.mode, latencyMs, timestamp: new Date().toISOString(), fallbackReason },
    }
  }

  try {
    let timeout
    try {
      liveResult = await Promise.race([
        liveFn(),
        new Promise((_, reject) => {
          timeout = setTimeout(() => reject(new Error(`SAP request exceeded ${config.timeoutMs}ms.`)), config.timeoutMs)
        }),
      ])
    } finally {
      clearTimeout(timeout)
    }
    if (!liveResult?.ok) throw new Error(liveResult?.error || 'SAP returned an unsuccessful response.')
    if (liveResult.status !== 204 && !isUsableData(liveResult.data)) throw new Error('SAP returned no usable records.')

    const latencyMs = Number.isFinite(liveResult.latencyMs) ? liveResult.latencyMs : Date.now() - startedAt
    updateTelemetry(systemName, {
      source: 'SAP_LIVE',
      latencyMs,
      payload: liveResult.requestPayload ?? liveResult.data,
    })
    return {
      data: liveResult.data,
      meta: { source: 'SAP_LIVE', system: systemName, mode: config.mode, latencyMs, timestamp: new Date().toISOString() },
    }
  } catch (error) {
    const reason = error?.message || 'Unknown SAP connection failure.'
    const latencyMs = Date.now() - startedAt
    console.warn(`SAP ${systemName} unavailable; using local fallback (${reason})`)
    const data = await fallbackFn()
    updateTelemetry(systemName, {
      source: 'LOCAL_FALLBACK',
      latencyMs,
      payload: liveResult?.requestPayload,
      fallbackReason: reason,
    })
    return {
      data,
      meta: { source: 'LOCAL_FALLBACK', system: systemName, mode: config.mode, latencyMs, timestamp: new Date().toISOString(), fallbackReason: reason },
    }
  }
}

export async function fetchSuppliers() {
  const localRows = await getSuppliers(prisma)
  return executeWithFallback('SAP_ARIBA', async () => {
    const response = await aribaAdapter.fetchSuppliers()
    return response.ok ? { ...response, data: normalizeSuppliers(response.data, localRows) } : response
  }, () => localRows)
}

export async function fetchPurchaseOrders() {
  const [localRows, localSuppliers] = await Promise.all([getPurchaseOrders(prisma), getSuppliers(prisma)])
  return executeWithFallback('SAP_S4HANA', async () => {
    const response = await s4hanaAdapter.fetchPurchaseOrders()
    return response.ok ? { ...response, data: normalizePurchaseOrders(response.data, localRows, localSuppliers) } : response
  }, () => localRows)
}

export async function fetchInventory() {
  const localRows = await getInventory(prisma)
  return executeWithFallback('SAP_S4HANA', async () => {
    const response = await s4hanaAdapter.fetchInventory()
    return response.ok ? { ...response, data: normalizeInventory(response.data, localRows) } : response
  }, () => localRows)
}

export async function fetchBOM() {
  const localRows = await getBOM(prisma)
  return executeWithFallback('SAP_S4HANA', async () => {
    const response = await s4hanaAdapter.fetchBOM()
    return response.ok ? { ...response, data: normalizeBOM(response.data, localRows) } : response
  }, () => localRows)
}

export async function fetchDemandSignals() {
  return executeWithFallback('SAP_IBP', async () => {
    const response = await ibpAdapter.fetchDemandSignals()
    return response.ok ? { ...response, data: unwrapODataCollection(response.data) } : response
  }, async () => [])
}

export async function pushSourcingDecision(payload) {
  return executeWithFallback('SAP_ARIBA', () => aribaAdapter.pushSourcingDecision(payload), async () => ({ queued: false }))
}

export async function pushStockoutAlert(payload) {
  return executeWithFallback('SAP_IBP', () => ibpAdapter.pushStockoutAlert(payload), async () => ({ queued: false }))
}

export async function logHumanApprovalWorkflow({ incidentId, approver = 'Meera Nair', decision, varianceINR }) {
  return executeWithFallback(
    'SAP_BUILD_PROCESS',
    () => buildProcessAdapter.logHumanApprovalWorkflow({ incidentId, approver, decision, varianceINR }),
    async () => ({ loggedLocally: true, incidentId, approver, decision, varianceINR }),
  )
}

export async function syncApprovedReallocation({
  approvalRecord,
  splitAllocations,
  persistLocally,
  markLocallySynced,
}) {
  const odataPayload = buildS4HanaPurchaseOrderPayload(approvalRecord, splitAllocations)
  lastApprovalPayload = odataPayload
  updateTelemetry('SAP_S4HANA', {
    source: 'LOCAL_FALLBACK',
    latencyMs: 0,
    payload: odataPayload,
    fallbackReason: 'Approval payload recorded; SAP live sync has not completed.',
  })

  const localResult = await persistLocally(odataPayload)
  const result = await executeWithFallback('SAP_S4HANA', async () => {
    const config = getSapConfig()
    if (!config.allowLiveWrite) throw new Error('SAP live writes are disabled by SAP_ALLOW_LIVE_WRITE=false.')
    const requiredMappings = [config.companyCode, config.purchasingOrganization, config.purchasingGroup, config.plantCode]
    if (requiredMappings.some(value => !value)) {
      throw new Error('SAP live writes require SAP company code, purchasing organization, purchasing group, and plant mappings.')
    }
    return s4hanaAdapter.pushSplitPurchaseOrders(odataPayload)
  }, async () => localResult)

  if (result.meta.source === 'SAP_LIVE' && markLocallySynced) {
    await markLocallySynced(localResult)
  }
  updateTelemetry('SAP_S4HANA', {
    source: result.meta.source,
    latencyMs: result.meta.latencyMs,
    payload: odataPayload,
    fallbackReason: result.meta.fallbackReason,
  })
  return { ...result, payload: odataPayload, localResult }
}

export function setSapMode(mode) {
  const config = setRuntimeSapMode(mode)
  for (const [system] of SYSTEMS) {
    const state = telemetry.get(system)
    if (mode === 'fallback') {
      telemetry.set(system, { ...state, activeSource: 'LOCAL_FALLBACK', lastFallbackReason: 'Local sandbox mode selected.' })
    } else if (state.activeSource !== 'SAP_LIVE') {
      telemetry.set(system, {
        ...state,
        activeSource: 'LOCAL_FALLBACK',
        lastFallbackReason: isSapSystemConfigured(system, config)
          ? 'Connection check required after mode change.'
          : 'SAP credentials or endpoint configuration are missing.',
      })
    }
  }
  return config
}

export function getSapStatus() {
  const config = getSapConfig()
  const configured = getSapSystemConfiguration(config)
  const systems = SYSTEMS.map(([system, name]) => {
    const state = telemetry.get(system)
    const activeSource = config.mode === 'fallback' ? 'LOCAL_FALLBACK' : state.activeSource
    const reason = config.mode === 'fallback'
      ? 'Local sandbox mode selected.'
      : state.lastFallbackReason || (configured[system]
        ? 'Connection test has not run in this process.'
        : 'SAP credentials or endpoint configuration are missing.')
    return {
      system,
      name,
      configured: configured[system],
      source: activeSource,
      activeSource,
      mode: config.mode,
      lastChecked: state.lastChecked,
      lastLatencyMs: state.lastLatencyMs,
      lastPayload: state.lastPayload,
      lastFallbackReason: config.mode === 'fallback' ? 'Local sandbox mode selected.' : reason,
    }
  })
  return {
    mode: config.mode,
    timeoutMs: config.timeoutMs,
    allowLiveWrite: config.allowLiveWrite,
    systems,
    lastApprovalPayload,
  }
}

export async function testSapConnections() {
  const [s4, ariba, ibp] = await Promise.all([fetchPurchaseOrders(), fetchSuppliers(), fetchDemandSignals()])
  return {
    mode: getSapConfig().mode,
    lastApprovalPayload,
    systems: getSapStatus().systems.map(system => {
      const result = system.system === 'SAP_S4HANA' ? s4
        : system.system === 'SAP_ARIBA' ? ariba
          : system.system === 'SAP_IBP' ? ibp
            : null
      return result
        ? { ...system, source: result.meta.source, activeSource: result.meta.source, lastLatencyMs: result.meta.latencyMs, lastFallbackReason: result.meta.fallbackReason || null }
        : system
    }),
    diagnostics: {
      liveReadSystems: ['SAP_S4HANA', 'SAP_ARIBA', 'SAP_IBP'],
      skippedSystems: ['SAP_BTP_RUNTIME', 'SAP_BUILD_PROCESS'],
      note: 'BTP runtime is not probed from a local extension process; Build Process webhooks are not invoked by a connection test.',
    },
  }
}

export function getLastApprovalPayload() {
  return lastApprovalPayload
}
