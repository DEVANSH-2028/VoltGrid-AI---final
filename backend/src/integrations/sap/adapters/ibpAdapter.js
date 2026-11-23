import { getSapConfig } from '../sapConfig.js'
import { sapHttpRequest } from '../sapHttpClient.js'

function endpoint(path) {
  return `${getSapConfig().ibpBaseUrl.replace(/\/+$/, '')}/${path}`
}

export async function fetchDemandSignals() {
  const config = getSapConfig()
  return sapHttpRequest({ url: endpoint('demand-signals'), token: config.ibpToken })
}

export async function pushStockoutAlert(payload) {
  const config = getSapConfig()
  const result = await sapHttpRequest({ url: endpoint('stockout-alerts'), method: 'POST', token: config.ibpToken, body: payload })
  return { ...result, requestPayload: payload }
}
