import { getSapConfig } from '../sapConfig.js'
import { sapHttpRequest } from '../sapHttpClient.js'

export async function logHumanApprovalWorkflow({ incidentId, approver = 'Meera Nair', decision, varianceINR }) {
  const config = getSapConfig()
  const payload = { incidentId, approver, decision, varianceINR }
  const result = await sapHttpRequest({
    url: config.buildWebhookUrl,
    method: 'POST',
    token: config.buildToken,
    body: payload,
  })
  return { ...result, requestPayload: payload }
}
