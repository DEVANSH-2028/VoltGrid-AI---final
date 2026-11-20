import { optimizeAllocation } from '../services/optimization.js'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export async function runVoltRoute(params) {
  const suppliers = await prisma.supplier.findMany()
  const demand = Number(params.demand || 1000)
  return optimizeAllocation({ suppliers, demand, tariffIncrease:Number(params.tariffIncrease||0), strategy:params.strategy||'BALANCED', inventoryLevel:Number(params.inventoryLevel||100) })
}
