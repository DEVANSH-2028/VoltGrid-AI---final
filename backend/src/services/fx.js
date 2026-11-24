const CACHE_MS = 5 * 60 * 1000
const SEEDED_RATES = {
  USD: { INR: 83.12, EUR: 0.92, CNY: 7.18 },
}

function validRate(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0
}

function parseFrankfurter(data, base, symbols) {
  const rows = Array.isArray(data) ? data : []
  const rates = {}
  for (const symbol of symbols) {
    const row = rows.find(item => String(item.base).toUpperCase() === base && String(item.quote).toUpperCase() === symbol)
    if (row && validRate(row.rate)) rates[symbol] = { rate: Number(row.rate), sourceDate: row.date || null }
  }
  return rates
}

export function createFxService({ fetchJson, now = Date.now, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  const cache = new Map()

  async function requestWithRetry(url) {
    let lastError
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await fetchJson(url)
      } catch (error) {
        lastError = error
        if (attempt === 0) await wait(300)
      }
    }
    throw lastError
  }

  async function latest(prisma, base = 'USD', symbols = ['INR', 'EUR', 'CNY'], onUpdate, { forceRefresh = false } = {}) {
    base = String(base).toUpperCase()
    symbols = [...new Set(symbols.map(symbol => String(symbol).trim().toUpperCase()))].sort()
    if (!/^[A-Z]{3}$/.test(base) || symbols.length === 0 || symbols.some(symbol => !/^[A-Z]{3}$/.test(symbol))) {
      throw new Error('FX base and symbols must be three-letter currency codes.')
    }

    const key = `${base}:${symbols.join(',')}`
    const memory = cache.get(key)
    if (!forceRefresh && memory && now() - memory.savedAt < CACHE_MS) return { ...memory.payload, status: 'CACHED', cached: true }
    const previous = memory?.payload?.rates || {}
    let rates = {}
    let source = null
    let sourceDate = null
    const errors = []

    try {
      const query = encodeURIComponent(symbols.join(','))
      const data = await requestWithRetry(`https://api.frankfurter.dev/v2/rates?base=${base}&quotes=${query}`)
      rates = parseFrankfurter(data, base, symbols)
      if (Object.keys(rates).length !== symbols.length) throw new Error('Frankfurter response was missing one or more requested rates.')
      source = 'Frankfurter'
      sourceDate = Object.values(rates).find(item => item.sourceDate)?.sourceDate || null
    } catch (error) {
      errors.push(`Frankfurter: ${error.message}`)
      try {
        const data = await requestWithRetry(`https://open.er-api.com/v6/latest/${base}`)
        if (data?.result !== 'success') throw new Error('Provider did not report success.')
        rates = Object.fromEntries(symbols
          .filter(symbol => validRate(data.rates?.[symbol]))
          .map(symbol => [symbol, { rate: Number(data.rates[symbol]), sourceDate: data.time_last_update_utc || null }]))
        if (Object.keys(rates).length !== symbols.length) throw new Error('Fallback response was missing one or more requested rates.')
        source = 'open.er-api.com'
        sourceDate = data.time_last_update_utc || null
      } catch (fallbackError) {
        errors.push(`open.er-api.com: ${fallbackError.message}`)
      }
    }

    let status = 'LIVE'
    if (!source) {
      const snapshots = await prisma.exchangeRateSnapshot.findMany({
        where: { base, quote: { in: symbols } },
        orderBy: { retrievedAt: 'desc' },
      })
      const saved = new Map()
      for (const snapshot of snapshots) {
        if (!saved.has(snapshot.quote)) saved.set(snapshot.quote, snapshot)
      }
      for (const symbol of symbols) {
        const snapshot = saved.get(symbol)
        if (snapshot && validRate(snapshot.rate)) {
          rates[symbol] = { rate: snapshot.rate, sourceDate: snapshot.sourceDate || null, source: snapshot.source, retrievedAt: snapshot.retrievedAt }
        } else if (validRate(SEEDED_RATES[base]?.[symbol])) {
          rates[symbol] = { rate: SEEDED_RATES[base][symbol], sourceDate: null, source: 'Seeded demonstration rate', retrievedAt: null }
        } else {
          rates[symbol] = { rate: null, sourceDate: null, source: 'Unavailable', retrievedAt: null }
        }
      }
      if (Object.values(rates).some(item => item.source === 'Seeded demonstration rate')) status = 'FALLBACK'
      else if (Object.values(rates).every(item => item.source === 'Unavailable')) status = 'OFFLINE'
      else status = 'CACHED'
      source = status === 'FALLBACK' ? 'Saved snapshots / seeded demonstration'
        : status === 'CACHED' ? 'Saved SQLite snapshots'
          : 'Unavailable'
    } else {
      for (const [quote, value] of Object.entries(rates)) {
        await prisma.exchangeRateSnapshot.create({
          data: { base, quote, rate: value.rate, source, sourceDate: value.sourceDate || sourceDate, stale: false },
        })
        rates[quote] = { ...value, source }
      }
    }

    for (const symbol of symbols) {
      const old = previous[symbol]?.rate
      const current = rates[symbol]?.rate
      rates[symbol] = {
        ...rates[symbol],
        previousRate: validRate(old) ? old : null,
        changePct: validRate(old) && validRate(current) ? Number(((current - old) / old * 100).toFixed(3)) : null,
      }
    }

    const payload = {
      base,
      rates,
      source,
      sourceDate,
      retrievedAt: new Date(now()).toISOString(),
      status,
      stale: status !== 'LIVE',
      warning: errors.length ? errors.join(' ') : null,
      cached: false,
    }
    cache.set(key, { savedAt: now(), payload })
    if (prisma.externalDataSource?.updateMany) {
      await prisma.externalDataSource.updateMany({
        where: { name: 'Frankfurter' },
        data: {
          status: status === 'LIVE' ? 'CONNECTED' : status === 'CACHED' ? 'STALE' : 'OFFLINE',
          freshness: source,
          lastSyncAt: new Date(now()),
        },
      })
    }
    if (status === 'LIVE' && typeof onUpdate === 'function') onUpdate(payload)
    return payload
  }

  return { latest }
}

async function defaultFetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(6000) })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

const defaultFxService = createFxService({ fetchJson: defaultFetchJson })

export function getFxLatest(prisma, base, symbols, onUpdate, options) {
  return defaultFxService.latest(prisma, base, symbols, onUpdate, options)
}

export async function getCurrencyRate(prisma, base = 'USD', quote = 'INR', amount = 1, onUpdate) {
  const result = await getFxLatest(prisma, base, [quote], onUpdate)
  const entry = result.rates[String(quote).toUpperCase()]
  return {
    source: entry?.source || result.source,
    base: result.base,
    quote: String(quote).toUpperCase(),
    rate: entry?.rate ?? null,
    convertedAmount: validRate(entry?.rate) ? Number((Number(amount || 1) * entry.rate).toFixed(2)) : null,
    sourceDate: entry?.sourceDate || result.sourceDate,
    retrievedAt: result.retrievedAt,
    verified: result.status === 'LIVE' || result.status === 'CACHED',
    stale: result.stale,
    status: result.status,
    warning: result.warning,
  }
}
