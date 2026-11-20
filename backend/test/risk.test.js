import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateRisk } from '../src/engines/risk.js'

test('risk calculation is bounded and contribution weights sum to overall risk',()=>{
  const result=calculateRisk({tariffIncrease:35,inventoryLevel:68,delayDays:21,affectedSuppliers:[1,2,3],severity:'CRITICAL',concentration:65,dva:58.4})
  assert.equal(result.overallRisk >= 0 && result.overallRisk <= 100,true)
  const sum=Object.values(result.breakdown).reduce((total,item)=>total+item.contribution,0)
  assert.ok(Math.abs(sum-result.overallRisk)<=1)
})
