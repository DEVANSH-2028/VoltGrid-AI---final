import { getSapConfig } from '../sapConfig.js'
import { sapHttpRequest } from '../sapHttpClient.js'

function endpoint(path) {
  return `${getSapConfig().aribaBaseUrl.replace(/\/+$/, '')}/${path}`
}

export async function fetchSuppliers() {
  const config = getSapConfig()
  return sapHttpRequest({ url: endpoint('suppliers'), token: config.aribaToken })
}

export async function pushSourcingDecision(payload) {
  const config = getSapConfig()
  const result = await sapHttpRequest({ url: endpoint('sourcing-decisions'), method: 'POST', token: config.aribaToken, body: payload })
  return { ...result, requestPayload: payload }
}
