import dotenv from 'dotenv'
import { DatabaseSync } from 'node:sqlite'
import { PrismaClient } from '@prisma/client'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const projectDirectory = path.resolve(backendDirectory, '..')
const sourcePath = path.join(backendDirectory, 'prisma', 'dev.db')
const dateFields = new Set(['createdAt', 'updatedAt', 'lastSyncAt', 'fxRetrievedAt', 'retrievedAt'])

dotenv.config({ path: path.join(projectDirectory, '.env.local'), quiet: true })
dotenv.config({ path: path.join(backendDirectory, '.env'), quiet: true })

const models = [
  { table: 'Plant', delegate: 'plant' },
  { table: 'User', delegate: 'user' },
  { table: 'Supplier', delegate: 'supplier', booleans: ['domestic', 'dvaEligible'] },
  { table: 'Component', delegate: 'component' },
  { table: 'BOM', delegate: 'bOM' },
  { table: 'Inventory', delegate: 'inventory' },
  { table: 'PurchaseOrder', delegate: 'purchaseOrder', booleans: ['erpSynced'] },
  { table: 'PurchaseOrderItem', delegate: 'purchaseOrderItem' },
  { table: 'DisruptionEvent', delegate: 'disruptionEvent', booleans: ['confirmed'] },
  { table: 'Incident', delegate: 'incident' },
  { table: 'AgentExecution', delegate: 'agentExecution' },
  { table: 'RiskAssessment', delegate: 'riskAssessment' },
  { table: 'SupplierAllocation', delegate: 'supplierAllocation' },
  { table: 'ComplianceAssessment', delegate: 'complianceAssessment' },
  { table: 'Approval', delegate: 'approval' },
  { table: 'AuditLog', delegate: 'auditLog' },
  { table: 'UploadedDocument', delegate: 'uploadedDocument', booleans: ['verified'] },
  { table: 'ExternalDataSource', delegate: 'externalDataSource' },
  { table: 'SimulationScenario', delegate: 'simulationScenario' },
  { table: 'SustainabilityRecord', delegate: 'sustainabilityRecord' },
  { table: 'ExchangeRateSnapshot', delegate: 'exchangeRateSnapshot', booleans: ['stale'] },
  { table: 'ShippingRoute', delegate: 'shippingRoute' },
  { table: 'MaritimeSnapshot', delegate: 'maritimeSnapshot' },
  { table: 'CarbonEmissionFactor', delegate: 'carbonEmissionFactor' },
]

function openSource() {
  const source = new DatabaseSync(sourcePath, { readOnly: true })
  source.exec('PRAGMA query_only = ON')
  return source
}

function readSource(source) {
  const tables = new Set(source.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
  ).all().map(row => row.name))

  return models.map(model => {
    if (!tables.has(model.table)) throw new Error(`SQLite source is missing the ${model.table} table.`)
    const records = source.prepare(`SELECT * FROM "${model.table}"`).all().map(row => {
      const converted = { ...row }
      for (const field of dateFields) {
        if (converted[field] != null) {
          const value = new Date(converted[field])
          if (!Number.isFinite(value.getTime())) throw new Error(`Invalid ${field} value found in ${model.table}.`)
          converted[field] = value
        }
      }
      for (const field of model.booleans || []) {
        if (converted[field] != null) converted[field] = Boolean(converted[field])
      }
      return converted
    })
    return { ...model, records }
  })
}

function printCounts(sourceRows) {
  console.log('Read-only SQLite source preview:')
  for (const { table, records } of sourceRows) console.log(`  ${table}: ${records.length}`)
}

async function assertEmptyTarget(prisma) {
  const counts = await Promise.all(models.map(async model => ({
    table: model.table,
    count: await prisma[model.delegate].count(),
  })))
  const populated = counts.filter(({ count }) => count > 0)
  if (populated.length) {
    throw new Error(`Target is not empty (${populated.map(({ table, count }) => `${table}: ${count}`).join(', ')}). No records were imported.`)
  }
}

async function main() {
  const source = openSource()
  let prisma
  try {
    const sourceRows = readSource(source)
    printCounts(sourceRows)

    if (!process.argv.includes('--confirm-empty-target')) {
      console.log('Preview only. To import, first apply the Prisma migrations, verify the Neon branch, then pass --confirm-empty-target.')
      return
    }

    if (!process.env.DATABASE_URL || !process.env.DATABASE_URL_UNPOOLED) {
      throw new Error('Both Neon database URLs are required for the one-time import. Set them in the ignored root .env.local file.')
    }

    prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL_UNPOOLED } } })
    await assertEmptyTarget(prisma)

    await prisma.$transaction(async transaction => {
      for (const { table, delegate, records } of sourceRows) {
        for (let offset = 0; offset < records.length; offset += 500) {
          const batch = records.slice(offset, offset + 500)
          if (batch.length) await transaction[delegate].createMany({ data: batch })
        }
      }
      for (const { table, delegate, records } of sourceRows) {
        const importedCount = await transaction[delegate].count()
        if (importedCount !== records.length) {
          throw new Error(`Imported row count mismatch for ${table}: expected ${records.length}, found ${importedCount}.`)
        }
      }
    }, { maxWait: 10_000, timeout: 120_000 })

    for (const { table, records } of sourceRows) console.log(`Imported ${records.length} ${table} record(s).`)
    console.log('SQLite data imported. The source database was opened read-only and was not changed.')
  } finally {
    source.close()
    await prisma?.$disconnect()
  }
}

main().catch(error => {
  const message = String(error?.message || 'Unknown migration error')
    .replace(/postgres(?:ql)?:\/\/[^\s"'`]+/gi, 'postgresql://[redacted]')
  console.error(`SQLite to PostgreSQL import failed: ${message}`)
  process.exitCode = 1
})
