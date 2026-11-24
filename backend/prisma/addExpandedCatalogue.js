import '../src/config/loadEnv.js'
import { PrismaClient } from '@prisma/client'
import { componentSeedRows, supplierCoordinates, supplierSeedRows } from '../src/integrations/sap/seedDefaults.js'

const prisma = new PrismaClient()

async function main() {
  for (const [code, name, category, unitCost, co2PerUnit] of componentSeedRows) {
    await prisma.component.upsert({
      where: { code },
      update: { name, category, unitCost, co2PerUnit },
      create: { code, name, category, unitCost, co2PerUnit },
    })
  }

  for (let index = 0; index < supplierSeedRows.length; index++) {
    const row = supplierSeedRows[index]
    const [code, name, country, region, city, domestic, dvaEligible, qualityScore, reliability, capacity, leadTimeDays, tariffRate, riskScore, statusScore] = row
    const [latitude, longitude] = supplierCoordinates[index]
    await prisma.supplier.upsert({
      where: { code },
      update: { name, country, region, city, latitude, longitude, domestic, dvaEligible, qualityScore, reliability, capacity, leadTimeDays, tariffRate, riskScore, status: statusScore > 18 ? 'WARNING' : 'HEALTHY' },
      create: { code, name, country, region, city, latitude, longitude, domestic, dvaEligible, qualityScore, reliability, capacity, leadTimeDays, tariffRate, riskScore, status: statusScore > 18 ? 'WARNING' : 'HEALTHY' },
    })
  }

  await prisma.externalDataSource.upsert({
    where: { id: 'seed-source-hormuz' },
    update: { name: 'Hormuz AIS', kind: 'MARITIME', status: 'AVAILABLE', freshness: '30-minute source interval', sourceUrl: 'https://hormuz.data-tracking.net/api' },
    create: { id: 'seed-source-hormuz', name: 'Hormuz AIS', kind: 'MARITIME', status: 'AVAILABLE', freshness: '30-minute source interval', sourceUrl: 'https://hormuz.data-tracking.net/api' },
  })
  await prisma.externalDataSource.upsert({
    where: { id: 'seed-source-worldbank' },
    update: { name: 'World Bank', kind: 'COUNTRY', status: 'AVAILABLE', freshness: 'Annual publication', sourceUrl: 'https://api.worldbank.org/v2/' },
    create: { id: 'seed-source-worldbank', name: 'World Bank', kind: 'COUNTRY', status: 'AVAILABLE', freshness: 'Annual publication', sourceUrl: 'https://api.worldbank.org/v2/' },
  })

  console.log(`Expanded catalogue loaded: ${supplierSeedRows.length} suppliers, ${componentSeedRows.length} components`)
}

main().finally(() => prisma.$disconnect())
