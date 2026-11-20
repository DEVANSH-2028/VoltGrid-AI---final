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
