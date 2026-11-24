import test from 'node:test'
import assert from 'node:assert/strict'
import { createFxService } from '../src/services/fx.js'

function fakePrisma(snapshots = []) {
  const saved = [...snapshots]
  return {
    saved,
    exchangeRateSnapshot: {
      create: async ({ data }) => { saved.unshift({ ...data, retrievedAt: new Date('2026-11-23T00:00:00Z') }) },
      findMany: async ({ where }) => saved.filter(row => row.base === where.base && where.quote.in.includes(row.quote)),
    },
  }
}

const frankfurterRows = [
  { base: 'USD', quote: 'INR', rate: 92.5, date: '2026-11-23' },
  { base: 'USD', quote: 'EUR', rate: 0.87, date: '2026-11-23' },
  { base: 'USD', quote: 'CNY', rate: 7.1, date: '2026-11-23' },
]

test('FX service fetches Frankfurter rates, persists snapshots, and publishes live updates', async () => {
  let published
  const prisma = fakePrisma()
  const service = createFxService({ fetchJson: async () => frankfurterRows, wait: async () => {} })
  const result = await service.latest(prisma, 'USD', ['INR', 'EUR', 'CNY'], value => { published = value })
  assert.equal(result.status, 'LIVE')
  assert.equal(result.rates.INR.rate, 92.5)
  assert.equal(prisma.saved.length, 3)
  assert.equal(published, result)
})

test('FX service fails over to open.er-api after retrying Frankfurter', async () => {
  let frankfurterCalls = 0
  const service = createFxService({
    fetchJson: async url => {
      if (url.includes('frankfurter')) { frankfurterCalls++; throw new Error('offline') }
      return { result: 'success', rates: { INR: 92, EUR: 0.86, CNY: 7.09 }, time_last_update_utc: 'Mon, 23 Nov 2026 00:00:00 +0000' }
    },
    wait: async () => {},
  })
  const result = await service.latest(fakePrisma(), 'USD', ['INR', 'EUR', 'CNY'])
  assert.equal(frankfurterCalls, 2)
  assert.equal(result.status, 'LIVE')
  assert.equal(result.source, 'open.er-api.com')
  assert.equal(result.rates.CNY.rate, 7.09)
})

test('FX service uses saved snapshots and seeded labelled fallbacks when providers are offline', async () => {
  const service = createFxService({ fetchJson: async () => { throw new Error('offline') }, wait: async () => {} })
  const snapshots = [
    { base: 'USD', quote: 'INR', rate: 91, source: 'Frankfurter', sourceDate: '2026-11-20', retrievedAt: new Date('2026-11-20T00:00:00Z') },
  ]
  const result = await service.latest(fakePrisma(snapshots), 'USD', ['INR', 'EUR'])
  assert.equal(result.status, 'FALLBACK')
  assert.equal(result.rates.INR.rate, 91)
  assert.equal(result.rates.EUR.source, 'Seeded demonstration rate')
  assert.equal(result.stale, true)
})

test('FX service caches provider results and rejects invalid currency codes', async () => {
  let requests = 0
  const service = createFxService({ fetchJson: async () => { requests++; return frankfurterRows }, wait: async () => {} })
  const prisma = fakePrisma()
  const first = await service.latest(prisma, 'USD', ['INR', 'EUR', 'CNY'])
  const second = await service.latest(prisma, 'USD', ['INR', 'EUR', 'CNY'])
  assert.equal(requests, 1)
  assert.equal(second.cached, true)
  assert.equal(second.status, 'CACHED')
  await assert.rejects(() => service.latest(prisma, 'US1', ['INR']), /three-letter currency codes/)
})
