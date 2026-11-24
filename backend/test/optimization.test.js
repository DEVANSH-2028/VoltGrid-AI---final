import test from 'node:test'
import assert from 'node:assert/strict'
import { optimizeAllocation } from '../src/services/optimization.js'

const suppliers=[
  {id:'cn',name:'China Cell Co',country:'China',domestic:false,dvaEligible:false,qualityScore:96,reliability:85,capacity:100,leadTimeDays:35},
  {id:'in',name:'India Cell Co',country:'India',domestic:true,dvaEligible:true,qualityScore:94,reliability:96,capacity:100,leadTimeDays:18},
]

test('balanced optimization allocates deterministically and includes diversification',()=>{
  const a=optimizeAllocation({suppliers,demand:1000,tariffIncrease:35,strategy:'BALANCED',inventoryLevel:68})
  assert.equal(a.allocation.length,2)
  assert.equal(a.allocation.reduce((sum,x)=>sum+x.quantity,0),1000)
  assert.equal(a.dva>=50,true)
})

test('domestic-heavy strategy favors domestic supplier',()=>{
  const a=optimizeAllocation({suppliers,demand:1000,tariffIncrease:35,strategy:'DOMESTIC',inventoryLevel:68})
  assert.equal(a.allocation[0].supplierId,'in')
})

test('imported landed cost reflects the saved FX rate and depreciation override',()=>{
  const imported=[suppliers[0]]
  const base=optimizeAllocation({suppliers:imported,demand:10,fxRate:83.12})
  const depreciated=optimizeAllocation({suppliers:imported,demand:10,fxRate:92.5,currencyDepreciation:5})
  assert.ok(depreciated.allocation[0].unitCost>base.allocation[0].unitCost)
  assert.equal(depreciated.fx.rate,92.5)
  assert.equal(depreciated.fx.currencyDepreciation,5)
})
