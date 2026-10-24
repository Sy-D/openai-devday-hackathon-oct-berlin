import test from 'node:test';
import assert from 'node:assert/strict';
import {orders,parts,factories} from '../data/network';
import {compatibility,createPlans,recommendedPlan,orderStatus} from './planner';

test('assembly waits for the last component, including purchased components',()=>{
  for(const plan of createPlans(orders[0])){
    assert.equal(plan.assemblyStart,Math.max(...plan.legs.map(l=>l.arrivalHours)));
    assert.equal(plan.etaHours,plan.assemblyStart+plan.assemblyHours+plan.finalTransportHours);
    assert.ok(plan.legs.some(l=>l.partId==='actuator'));
    assert.equal(plan.totalCost,Math.round(plan.productionCost+plan.transportCost+plan.assemblyCost));
  }
});
test('capability gates reject a cheaper factory with the wrong process and material',()=>{
  const lyon=factories.find(f=>f.id==='lyon')!;
  assert.ok(compatibility(lyon,parts[0],12).includes('SLS process unavailable'));
  assert.ok(compatibility(lyon,parts[0],12).includes('PA12 material unavailable'));
});
test('select cheapest feasible on-time plan and reroute after disruption',()=>{
  assert.equal(recommendedPlan(createPlans(orders[0]))?.id,'balanced');
  const disrupted=createPlans(orders[0],true);
  assert.ok(disrupted.find(p=>p.id==='balanced')!.bufferHours<0);
  assert.equal(recommendedPlan(disrupted)?.id,'express');
});
test('oversized orders have no feasible recommendation',()=>{
  const plans=createPlans({...orders[0],quantity:300});
  assert.ok(plans.every(p=>!p.feasible));assert.equal(recommendedPlan(plans),undefined);
});
test('assigning late plan keeps attention and disruption reopens assigned order',()=>{
  const base={orderId:orders[0].id,cost:1,etaHours:1,assignedAt:'test'};
  assert.equal(orderStatus(orders[0],{[orders[0].id]:{...base,planId:'economy'}}),'action');
  assert.equal(orderStatus(orders[0],{[orders[0].id]:{...base,planId:'balanced'}}),'planned');
  assert.equal(orderStatus(orders[0],{[orders[0].id]:{...base,planId:'balanced'}},true),'action');
});
