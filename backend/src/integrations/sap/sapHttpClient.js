import { getSapConfig } from './sapConfig.js'

const HARD_TIMEOUT_LIMIT_MS = 2500

export async function sapHttpRequest({
  url,
  method = 'GET',
  apiKey,
  token,
  body,
  headers = {},
  timeoutMs,
} = {}) {
  const startedAt = Date.now()
  const controller = new AbortController()
  const configuredTimeout = timeoutMs ?? getSapConfig().timeoutMs
  const boundedTimeout = Math.max(1, Math.min(Number(configuredTimeout) || HARD_TIMEOUT_LIMIT_MS, HARD_TIMEOUT_LIMIT_MS))
  // Leave room for event-loop scheduling and fallback serialization within the caller's deadline.
  const abortTimeout = Math.max(1, boundedTimeout - Math.min(75, Math.floor(boundedTimeout * 0.05)))
  const timeout = setTimeout(() => controller.abort(), abortTimeout)

  try {
    const requestHeaders = { Accept: 'application/json', ...headers }
    if (apiKey) requestHeaders.APIKey = apiKey
    if (token) requestHeaders.Authorization = `Bearer ${token}`
    if (body !== undefined) requestHeaders['Content-Type'] = 'application/json'

    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
    const responseText = await response.text()
    let data = null
    if (responseText) {
      try {
        data = JSON.parse(responseText)
      } catch {
        return {
          ok: false,
          status: response.status,
          data: null,
          error: 'SAP endpoint returned an invalid JSON payload.',
          latencyMs: Date.now() - startedAt,
        }
      }
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        data,
        error: `SAP endpoint returned HTTP ${response.status}.`,
        latencyMs: Date.now() - startedAt,
      }
    }
    return { ok: true, status: response.status, data, error: null, latencyMs: Date.now() - startedAt }
  } catch (error) {
    const timedOut = controller.signal.aborted || error?.name === 'AbortError'
    return {
      ok: false,
      status: null,
      data: null,
      error: timedOut ? `SAP request timed out after ${boundedTimeout}ms.` : `SAP request failed: ${error?.message || 'network error'}`,
      latencyMs: Date.now() - startedAt,
    }
  } finally {
    clearTimeout(timeout)
  }
}
