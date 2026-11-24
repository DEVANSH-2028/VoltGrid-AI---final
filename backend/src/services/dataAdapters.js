const currencyCache = new Map()
const newsCache = new Map()
const weatherCache = new Map()

async function fetchJson(url, timeoutMs = 7000) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'VoltGrid-AI/2.0' },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

export async function getCurrencyRate(prisma, base = 'USD', quote = 'INR', amount = 1) {
  base = String(base).toUpperCase()
  quote = String(quote).toUpperCase()
  const key = `${base}:${quote}`
  const cached = currencyCache.get(key)
  if (cached && Date.now() - cached.retrievedAt < 15 * 60 * 1000) {
    return { ...cached.payload, cached: true }
  }

  try {
    const data = await fetchJson(`https://api.frankfurter.dev/v2/rates?base=${base}&quotes=${quote}`)
    const matchingRow = Array.isArray(data)
      ? data.find(row => String(row.base).toUpperCase() === base && String(row.quote).toUpperCase() === quote)
      : null
    const rate = matchingRow ? Number(matchingRow.rate) : Number(data?.rates?.[quote])
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('Frankfurter returned no valid rate')
    const payload = {
      source: 'Frankfurter',
      base,
      quote,
      rate,
      convertedAmount: Number((Number(amount || 1) * rate).toFixed(2)),
      sourceDate: matchingRow?.date || data?.date || null,
      retrievedAt: new Date().toISOString(),
      verified: true,
      stale: false,
    }
    currencyCache.set(key, { retrievedAt: Date.now(), payload })
    await prisma.exchangeRateSnapshot.create({
      data: { base, quote, rate, source: 'Frankfurter', sourceDate: payload.sourceDate, stale: false },
    })
    await prisma.externalDataSource.updateMany({
      where: { name: 'Frankfurter' },
      data: { status: 'CONNECTED', freshness: 'Live reference rate', lastSyncAt: new Date() },
    })
    return { ...payload, cached: false }
  } catch (error) {
    const last = await prisma.exchangeRateSnapshot.findFirst({
      where: { base, quote },
      orderBy: { retrievedAt: 'desc' },
    })
    await prisma.externalDataSource.updateMany({
      where: { name: 'Frankfurter' },
      data: { status: last ? 'STALE' : 'OFFLINE', freshness: last ? 'Preserved last snapshot' : 'No successful snapshot', lastSyncAt: new Date() },
    })
    if (last) {
      const payload = {
        source: last.source,
        base,
        quote,
        rate: last.rate,
        convertedAmount: Number((Number(amount || 1) * last.rate).toFixed(2)),
        sourceDate: last.sourceDate,
        retrievedAt: last.retrievedAt.toISOString(),
        verified: true,
        stale: true,
        warning: `Live refresh failed: ${error.message}. Preserving the last successful snapshot.`,
      }
      return payload
    }
    return {
      source: 'Unavailable',
      base,
      quote,
      rate: null,
      convertedAmount: null,
      sourceDate: null,
      retrievedAt: null,
      verified: false,
      stale: true,
      warning: `Frankfurter is unavailable and no saved exchange-rate snapshot exists: ${error.message}`,
    }
  }
}

export async function getWeather(prisma, locations = ['Chakan']) {
  const key = locations.join('|')
  const cached = weatherCache.get(key)
  if (cached && Date.now() - cached.retrievedAt < 30 * 60 * 1000) return { ...cached.payload, cached: true }
  const coordinates = {
    Chakan: [18.7586, 73.8553],
    Shanghai: [31.2304, 121.4737],
    Ningbo: [29.8683, 121.5440],
    Shenzhen: [22.5431, 114.0579],
    Busan: [35.1796, 129.0756],
    Seoul: [37.5665, 126.9780],
    Tokyo: [35.6762, 139.6503],
    Singapore: [1.3521, 103.8198],
    Rotterdam: [51.9244, 4.4777],
  }
  try {
    const selected = locations.map(name => ({ name, coordinate: coordinates[name] })).filter(item => item.coordinate)
    const items = []
    for (const item of selected) {
      const [lat, lon] = item.coordinate
      const data = await fetchJson(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,precipitation&timezone=auto`)
      items.push({
        location: item.name,
        latitude: lat,
        longitude: lon,
        temperatureC: data?.current?.temperature_2m ?? null,
        windSpeedKmh: data?.current?.wind_speed_10m ?? null,
        precipitationMm: data?.current?.precipitation ?? null,
        observationTime: data?.current?.time || null,
        verified: true,
      })
    }
    const payload = { source: 'Open-Meteo', status: 'CONNECTED', retrievedAt: new Date().toISOString(), items }
    weatherCache.set(key, { retrievedAt: Date.now(), payload })
    await prisma.externalDataSource.updateMany({ where: { name: 'Open-Meteo' }, data: { status: 'CONNECTED', freshness: 'Live observation', lastSyncAt: new Date() } })
    return { ...payload, cached: false }
  } catch (error) {
    await prisma.externalDataSource.updateMany({ where: { name: 'Open-Meteo' }, data: { status: 'OFFLINE', freshness: 'Unavailable', lastSyncAt: new Date() } })
    return { source: 'Open-Meteo', status: 'OFFLINE', retrievedAt: new Date().toISOString(), items: [], warning: error.message }
  }
}

export async function getNews(prisma) {
  const key = 'gdelt-supply-chain'
  const cached = newsCache.get(key)
  if (cached && Date.now() - cached.retrievedAt < 15 * 60 * 1000) return { ...cached.payload, cached: true }
  try {
    const query = encodeURIComponent('(battery OR lithium) AND (tariff OR port OR shipping OR disruption)')
    const data = await fetchJson(`https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=ArtList&format=json&maxrecords=20&timespan=3d&sort=DateDesc`)
    const items = (Array.isArray(data?.articles) ? data.articles : []).slice(0, 20).map(article => ({
      headline: article.title || 'Untitled',
      url: article.url || null,
      publisher: article.domain || null,
      publicationTime: article.seendate || null,
      retrievedAt: new Date().toISOString(),
      matchedKeywords: ['battery', 'lithium', 'tariff', 'shipping', 'disruption'].filter(keyword => `${article.title || ''} ${article.url || ''}`.toLowerCase().includes(keyword)),
      relatedSupplierOrRegion: null,
      confidence: 'Headline match',
      verificationStatus: 'Unverified news — require confirmation',
    }))
    const payload = { source: 'GDELT', status: 'CONNECTED', retrievedAt: new Date().toISOString(), items }
    newsCache.set(key, { retrievedAt: Date.now(), payload })
    await prisma.externalDataSource.updateMany({ where: { name: 'GDELT' }, data: { status: 'CONNECTED', freshness: 'Live headline feed', lastSyncAt: new Date() } })
    return { ...payload, cached: false }
  } catch (error) {
    await prisma.externalDataSource.updateMany({ where: { name: 'GDELT' }, data: { status: 'OFFLINE', freshness: 'Unavailable', lastSyncAt: new Date() } })
    return { source: 'GDELT', status: 'OFFLINE', retrievedAt: new Date().toISOString(), items: [], warning: error.message }
  }
}
