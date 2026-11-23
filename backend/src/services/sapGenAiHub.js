import { OrchestrationClient } from '@sap-ai-sdk/orchestration'

const DEFAULT_MODEL = 'gemini-3.5-flash'
let client
let clientModel
let clientResourceGroup

export class SapGenAiConfigurationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'SapGenAiConfigurationError'
    this.code = 'SAP_GENAI_NOT_CONFIGURED'
  }
}

function getClient(model) {
  const resourceGroup = String(process.env.SAP_GENAI_RESOURCE_GROUP || '').trim()
  if (!client || clientModel !== model || clientResourceGroup !== resourceGroup) {
    client = new OrchestrationClient(
      {
        promptTemplating: {
          model: {
            name: model,
            timeout: 75,
          },
        },
      },
      resourceGroup ? { resourceGroup } : undefined,
    )
    clientModel = model
    clientResourceGroup = resourceGroup
  }
  return client
}

export async function generateSapGenAiAnswer({ question, evidence }) {
  if (!process.env.AICORE_SERVICE_KEY && !process.env.VCAP_SERVICES) {
    throw new SapGenAiConfigurationError(
      'SAP AI Core credentials are missing. Configure AICORE_SERVICE_KEY locally or bind an AI Core service to the backend.',
    )
  }

  const model = process.env.SAP_GENAI_MODEL || DEFAULT_MODEL
  const response = await getClient(model).chatCompletion({
    messages: [
      {
        role: 'system',
        content: [
          'You are VoltGrid AI, an EV battery sourcing risk analyst for Meera Nair at the Chakan plant.',
          'Answer using only the supplied database evidence. Do not invent supplier, PO, incident, policy, or financial facts.',
          'Explicitly describe figures as estimates or demo data when appropriate. Keep the answer concise and actionable.',
          'If the evidence does not answer the question, say what is missing.',
        ].join(' '),
      },
      {
        role: 'user',
        content: `Question:\n${question}\n\nDatabase evidence (JSON):\n${JSON.stringify(evidence)}`,
      },
    ],
  })

  const answer = response.getContent()?.trim()
  if (!answer) throw new Error('SAP Generative AI Hub returned an empty answer.')

  return { answer, tokenUsage: response.getTokenUsage() || null, model }
}
