const DEFAULT_TIMEOUT_MS = 2500
const MAX_TIMEOUT_MS = 2500
const DEFAULT_S4_SANDBOX_URL = 'https://sandbox.api.sap.com/s4hanacloud/sap/opu/odata/sap'
let runtimeMode = null

function isTrue(value) {
  return String(value || '').trim().toLowerCase() === 'true'
}

export function readSapConfig(env = process.env) {
  const requestedMode = String(env.SAP_MODE || 'auto').trim().toLowerCase()
  const environmentMode = ['auto', 'live', 'fallback'].includes(requestedMode) ? requestedMode : 'auto'
  const parsedTimeout = Number.parseInt(env.SAP_TIMEOUT_MS, 10)
  const timeoutMs = Number.isFinite(parsedTimeout) && parsedTimeout > 0
    ? Math.min(parsedTimeout, MAX_TIMEOUT_MS)
    : DEFAULT_TIMEOUT_MS
  const apiHubKey = String(env.SAP_API_HUB_KEY || '').trim()
  const s4hanaBaseUrl = String(env.SAP_S4HANA_BASE_URL || (apiHubKey ? DEFAULT_S4_SANDBOX_URL : '')).trim()

  return {
    mode: runtimeMode || environmentMode,
    environmentMode,
    timeoutMs,
    apiHubKey,
    s4hanaBaseUrl,
    s4hanaToken: String(env.SAP_S4HANA_TOKEN || '').trim(),
    aribaBaseUrl: String(env.SAP_ARIBA_BASE_URL || '').trim(),
    aribaToken: String(env.SAP_ARIBA_TOKEN || '').trim(),
    ibpBaseUrl: String(env.SAP_IBP_BASE_URL || '').trim(),
    ibpToken: String(env.SAP_IBP_TOKEN || '').trim(),
    buildWebhookUrl: String(env.SAP_BUILD_WEBHOOK_URL || '').trim(),
    buildToken: String(env.SAP_BUILD_TOKEN || '').trim(),
    allowLiveWrite: isTrue(env.SAP_ALLOW_LIVE_WRITE),
    companyCode: String(env.SAP_S4HANA_COMPANY_CODE || '').trim(),
    purchasingOrganization: String(env.SAP_S4HANA_PURCHASING_ORG || '').trim(),
    purchasingGroup: String(env.SAP_S4HANA_PURCHASING_GROUP || '').trim(),
    plantCode: String(env.SAP_S4HANA_PLANT || '').trim(),
    currency: String(env.SAP_S4HANA_CURRENCY || 'INR').trim(),
  }
}

export function getSapConfig() {
  return readSapConfig()
}

export function setRuntimeSapMode(mode) {
  if (!['auto', 'fallback'].includes(mode)) throw new Error('SAP mode must be "auto" or "fallback".')
  runtimeMode = mode
  return getSapConfig()
}

export function resetRuntimeSapMode() {
  runtimeMode = null
}

export function isSapSystemConfigured(systemName, config = getSapConfig()) {
  switch (systemName) {
    case 'SAP_S4HANA':
      return Boolean(config.s4hanaBaseUrl && (config.apiHubKey || config.s4hanaToken))
    case 'SAP_ARIBA':
      return Boolean(config.aribaBaseUrl && config.aribaToken)
    case 'SAP_IBP':
      return Boolean(config.ibpBaseUrl && config.ibpToken)
    case 'SAP_BUILD_PROCESS':
      return Boolean(config.buildWebhookUrl && config.buildToken)
    case 'SAP_BTP_RUNTIME':
      return Boolean(process.env.VCAP_SERVICES || process.env.AICORE_SERVICE_KEY)
    default:
      return false
  }
}

export function getSapSystemConfiguration(config = getSapConfig()) {
  return {
    SAP_S4HANA: isSapSystemConfigured('SAP_S4HANA', config),
    SAP_ARIBA: isSapSystemConfigured('SAP_ARIBA', config),
    SAP_IBP: isSapSystemConfigured('SAP_IBP', config),
    SAP_BTP_RUNTIME: isSapSystemConfigured('SAP_BTP_RUNTIME', config),
    SAP_BUILD_PROCESS: isSapSystemConfigured('SAP_BUILD_PROCESS', config),
  }
}
