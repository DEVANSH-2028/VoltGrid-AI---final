export async function getOllamaStatus() {
  const baseUrl = String(process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/$/, '')
  const model = String(process.env.OLLAMA_MODEL || 'qwen2.5:3b')
  try {
    const tags = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(1500) })
    if (!tags.ok) throw new Error(`Ollama returned HTTP ${tags.status}`)
    const data = await tags.json()
    const models = Array.isArray(data?.models) ? data.models : []
    const modelAvailable = models.some(item => item.name === model || item.model === model)
    return {
      provider: 'ollama',
      baseUrl,
      model,
      status: modelAvailable ? 'READY' : 'MODEL_MISSING',
      modelAvailable,
      message: modelAvailable ? 'Local Ollama model is available.' : `Ollama is reachable, but ${model} is not installed.`,
    }
  } catch (error) {
    return {
      provider: 'ollama',
      baseUrl,
      model,
      status: 'OFFLINE',
      modelAvailable: false,
      message: `Local AI unavailable: ${error.message}`,
    }
  }
}

export async function askOllama(prompt) {
  const status = await getOllamaStatus()
  if (status.status !== 'READY') return null
  const response = await fetch(`${status.baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: status.model, prompt, stream: false }),
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}`)
  const data = await response.json()
  const answer = String(data?.response || '').trim()
  if (!answer) throw new Error('Ollama returned an empty response')
  return { answer, source: `Ollama · ${status.model}` }
}
