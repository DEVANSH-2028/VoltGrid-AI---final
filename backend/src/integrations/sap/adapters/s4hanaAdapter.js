import { getSapConfig } from '../sapConfig.js'
import { sapHttpRequest } from '../sapHttpClient.js'

function serviceUrl(baseUrl, service, entity) {
  const cleanBase = String(baseUrl).replace(/\/+$/, '')
  const servicePath = `/${service}`
  const serviceRoot = cleanBase.toLowerCase().endsWith(servicePath.toLowerCase()) ? cleanBase : `${cleanBase}${servicePath}`
  return `${serviceRoot}/${entity}?$format=json&$top=100`
}

function authOptions(config) {
  return { apiKey: config.apiHubKey || undefined, token: config.s4hanaToken || undefined }
}

export async function fetchPurchaseOrders() {
  const config = getSapConfig()
  return sapHttpRequest({ url: serviceUrl(config.s4hanaBaseUrl, 'API_PURCHASEORDER_2', 'A_PurchaseOrder'), ...authOptions(config) })
}

export async function fetchInventory() {
  const config = getSapConfig()
  return sapHttpRequest({ url: serviceUrl(config.s4hanaBaseUrl, 'API_MATERIAL_STOCK_SRV', 'A_MaterialStock'), ...authOptions(config) })
}

export async function fetchBOM() {
  const config = getSapConfig()
  return sapHttpRequest({ url: serviceUrl(config.s4hanaBaseUrl, 'API_BILL_OF_MATERIAL_SRV', 'A_BillOfMaterial'), ...authOptions(config) })
}

export async function pushSplitPurchaseOrders(odataPayload) {
  const config = getSapConfig()
  const url = serviceUrl(config.s4hanaBaseUrl, 'API_PURCHASEORDER_2', 'A_PurchaseOrder').replace(/\?.*$/, '')
  const results = []
  let latencyMs = 0
  for (const payload of odataPayload.payloads || []) {
    const result = await sapHttpRequest({ url, method: 'POST', body: payload, ...authOptions(config) })
    latencyMs += result.latencyMs
    results.push({ ok: result.ok, status: result.status, data: result.data, error: result.error })
    if (!result.ok) {
      return {
        ok: false,
        status: result.status,
        data: { results, partial: results.some(item => item.ok) },
        error: result.error,
        latencyMs,
        requestPayload: odataPayload,
      }
    }
  }
  return {
    ok: true,
    status: results.at(-1)?.status || 200,
    data: { entitySet: 'A_PurchaseOrder', results },
    error: null,
    latencyMs,
    requestPayload: odataPayload,
  }
}
