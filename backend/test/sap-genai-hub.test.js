import test from 'node:test'
import assert from 'node:assert/strict'
import { generateSapGenAiAnswer } from '../src/services/sapGenAiHub.js'

test('SAP Generative AI requires an AI Core service key or service binding', async () => {
  const serviceKey = process.env.AICORE_SERVICE_KEY
  const serviceBindings = process.env.VCAP_SERVICES
  delete process.env.AICORE_SERVICE_KEY
  delete process.env.VCAP_SERVICES

  try {
    await assert.rejects(
      generateSapGenAiAnswer({ question: 'Explain risk', evidence: {} }),
      { code: 'SAP_GENAI_NOT_CONFIGURED' },
    )
  } finally {
    if (serviceKey === undefined) delete process.env.AICORE_SERVICE_KEY
    else process.env.AICORE_SERVICE_KEY = serviceKey
    if (serviceBindings === undefined) delete process.env.VCAP_SERVICES
    else process.env.VCAP_SERVICES = serviceBindings
  }
})
