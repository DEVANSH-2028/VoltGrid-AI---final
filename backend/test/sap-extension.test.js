import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { test } from 'node:test'
import { executeWithFallback, getSapStatus, syncApprovedReallocation } from '../src/integrations/sap/sapExtensionGateway.js'
import { readSapConfig, resetRuntimeSapMode, setRuntimeSapMode } from '../src/integrations/sap/sapConfig.js'
import { sapHttpRequest } from '../src/integrations/sap/sapHttpClient.js'
import { buildS4HanaPurchaseOrderPayload, normalizeSuppliers } from '../src/integrations/sap/sapMappers.js'
import { getPurchaseOrders, getSuppliers } from '../src/integrations/sap/fallbackStore.js'

function withEnvironment(values, callback) {
  const previous = new Map(Object.keys(values).map(key => [key, process.env[key]]))
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  return Promise.resolve()
    .then(callback)
    .finally(() => {
      resetRuntimeSapMode()
      for (const [key, value] of previous) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    })
}

test('SAP config defaults to auto and caps HTTP timeout at 2500ms', () => {
  const config = readSapConfig({ SAP_TIMEOUT_MS: '9000' })
  assert.equal(config.mode, 'auto')
  assert.equal(config.timeoutMs, 2500)
  assert.equal(readSapConfig({}).timeoutMs, 2500)
})

test('empty Prisma reads use the expanded seeded Chakan supplier and PO defaults', async () => {
  const fallbackPrisma = {
    supplier: { findMany: async () => [] },
    purchaseOrder: { findMany: async () => [] },
  }
  const [suppliers, orders] = await Promise.all([getSuppliers(fallbackPrisma), getPurchaseOrders(fallbackPrisma)])
  assert.equal(suppliers.length, 43)
  assert.equal(suppliers.find(supplier => supplier.code === 'SUP-IN-01').dvaEligible, true)
  assert.equal(orders.length, 6)
  assert.equal(orders[5].status, 'AT_RISK')
})

test('OData mapper retains local DVA, tariff, and category enrichment', () => {
  const [supplier] = normalizeSuppliers(
    { d: { results: [{ Supplier: 'SUP-IN-01', SupplierName: 'SAP supplier' }] } },
    [{ id: 'local-1', code: 'SUP-IN-01', domestic: true, dvaEligible: true, tariffRate: 0, tariffExposure: 0, componentCategory: 'Battery cells' }],
  )
  assert.equal(supplier.name, 'SAP supplier')
  assert.equal(supplier.domestic, true)
  assert.equal(supplier.dvaEligible, true)
  assert.equal(supplier.tariffExposure, 0)
  assert.equal(supplier.componentCategory, 'Battery cells')
})

test('split approval payloads use the A_PurchaseOrder entity set and OData navigation property', () => {
  const result = buildS4HanaPurchaseOrderPayload(
    { id: 'approval-1', incident: { incidentId: 'INC-1' } },
    [
      { supplier: { code: 'SUP-IN-01' }, component: { code: 'LFP-CELL' }, quantity: 12, unitCost: 42 },
      { supplier: { code: 'SUP-CN-01' }, component: { code: 'CAM' }, quantity: 8, unitCost: 31 },
    ],
  )
  assert.equal(result.entitySet, 'A_PurchaseOrder')
  assert.equal(result.payloads.length, 2)
  assert.equal(result.payloads[0].to_PurchaseOrderItem[0].Material, 'LFP-CELL')
  assert.equal(result.payloads[1].Supplier, 'SUP-CN-01')
})

test('fallback mode skips live calls and returns source metadata', async () => {
  await withEnvironment({ SAP_MODE: 'auto', SAP_ARIBA_BASE_URL: undefined, SAP_ARIBA_TOKEN: undefined }, async () => {
    setRuntimeSapMode('fallback')
    let liveCalls = 0
    const result = await executeWithFallback('SAP_ARIBA', async () => {
      liveCalls += 1
      return { ok: true, status: 200, data: [{ id: 1 }] }
    }, async () => [{ id: 'seed' }])
    assert.equal(liveCalls, 0)
    assert.deepEqual(result.data, [{ id: 'seed' }])
    assert.equal(result.meta.source, 'LOCAL_FALLBACK')
    assert.match(result.meta.fallbackReason, /Local sandbox mode/)
  })
})

test('live HTTP failures automatically return fallback records', async () => {
  await withEnvironment({ SAP_MODE: 'auto', SAP_ARIBA_BASE_URL: 'https://sap.example.invalid', SAP_ARIBA_TOKEN: 'test-token' }, async () => {
    let fallbackCalls = 0
    const result = await executeWithFallback('SAP_ARIBA', async () => ({
      ok: false, status: 403, data: null, error: 'SAP endpoint returned HTTP 403.', latencyMs: 4,
    }), async () => {
      fallbackCalls += 1
      return [{ id: 'seed' }]
    })
    assert.equal(fallbackCalls, 1)
    assert.equal(result.meta.source, 'LOCAL_FALLBACK')
    assert.match(result.meta.fallbackReason, /HTTP 403/)
  })
})

test('approval sync commits locally and records payload when live writes are disabled', async () => {
  await withEnvironment({
    SAP_MODE: 'auto',
    SAP_S4HANA_BASE_URL: 'https://sap.example.invalid',
    SAP_API_HUB_KEY: 'test-key',
    SAP_ALLOW_LIVE_WRITE: 'false',
  }, async () => {
    let commits = 0
    const result = await syncApprovedReallocation({
      approvalRecord: { id: 'approval-2', incident: { incidentId: 'INC-2' } },
      splitAllocations: [{ supplier: { code: 'SUP-IN-01' }, component: { code: 'LFP-CELL' }, quantity: 3, unitCost: 42 }],
      persistLocally: async payload => {
        commits += 1
        return { purchaseOrderIds: ['local-po'], payload }
      },
    })
    assert.equal(commits, 1)
    assert.equal(result.meta.source, 'LOCAL_FALLBACK')
    assert.match(result.meta.fallbackReason, /writes are disabled/)
    assert.equal(getSapStatus().lastApprovalPayload.entitySet, 'A_PurchaseOrder')
  })
})

test('SAP HTTP client applies APIKey and bearer headers and aborts timed-out requests', async () => {
  let observedHeaders
  let responseTimer
  const server = createServer((request, response) => {
    observedHeaders = request.headers
    if (request.url === '/slow') {
      responseTimer = setTimeout(() => response.end('{"late":true}'), 250)
      return
    }
    response.setHeader('content-type', 'application/json')
    response.end('{"value":[{"id":"live"}]}')
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  try {
    const live = await sapHttpRequest({ url: `http://127.0.0.1:${address.port}/live`, apiKey: 'key', token: 'token' })
    assert.equal(live.ok, true)
    assert.equal(observedHeaders.apikey, 'key')
    assert.equal(observedHeaders.authorization, 'Bearer token')

    const timedOut = await sapHttpRequest({ url: `http://127.0.0.1:${address.port}/slow`, timeoutMs: 30 })
    assert.equal(timedOut.ok, false)
    assert.match(timedOut.error, /timed out/)
  } finally {
    clearTimeout(responseTimer)
    server.closeAllConnections()
    server.close()
  }
})
