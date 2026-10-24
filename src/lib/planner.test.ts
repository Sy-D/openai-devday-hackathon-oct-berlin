import test from 'node:test';
import assert from 'node:assert/strict';
import {orders,parts,factories} from '../data/network';
import {assignmentReview,compatibility,createPlans,recommendedPlan,orderStatus,type Assignment} from './planner';

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
  const plan=createPlans(orders[0]).find(p=>p.id==='balanced')!;
  const base={orderId:orders[0].id,cost:plan.totalCost,etaHours:plan.etaHours,assignedAt:'test'};
  assert.equal(orderStatus(orders[0],{[orders[0].id]:{...base,planId:'economy'}}),'action');
  assert.equal(orderStatus(orders[0],{[orders[0].id]:{...base,planId:'balanced'}}),'planned');
  assert.equal(orderStatus(orders[0],{[orders[0].id]:{...base,planId:'balanced'}},true),'action');
});

test('quantity recomputes per-part capacity, full cost and assembly duration',()=>{
  const plans=createPlans({...orders[0],quantity:42});
  const balanced=plans.find(p=>p.id==='balanced')!,fastest=plans.find(p=>p.id==='express')!;
  assert.equal(balanced.feasible,false);
  assert.ok(balanced.issues.some(issue=>issue.includes('Capacity 80 below required 84')));
  assert.equal(fastest.feasible,true);
  assert.equal(fastest.totalCost,13081);
  assert.equal(fastest.legs.find(leg=>leg.partId==='fingers')?.quantity,84);
  assert.equal(fastest.assemblyHours,21);
  assert.equal(fastest.etaHours,49);
  assert.equal(recommendedPlan(plans)?.id,'express');
});

test('a tighter deadline changes recommendation, and no on-time route is explicit',()=>{
  assert.equal(recommendedPlan(createPlans({...orders[0],dueHours:40}))?.id,'express');
  assert.equal(recommendedPlan(createPlans({...orders[0],dueHours:33})),undefined);
  assert.equal(createPlans({...orders[0],dueHours:33}).find(p=>p.id==='express')?.bufferHours,-1);
});

test('confirmed snapshots need review after quantity or deadline changes, even if feasible',()=>{
  const order=orders[0],plan=createPlans(order).find(p=>p.id==='balanced')!;
  const assigned:Assignment={orderId:order.id,planId:plan.id,cost:plan.totalCost,etaHours:plan.etaHours,quantity:order.quantity,dueHours:order.dueHours,assignedAt:'test'};
  for(const changed of [{...order,quantity:13},{...order,dueHours:80}]){
    assert.equal(orderStatus(changed,{[order.id]:assigned}),'action');
    assert.match(assignmentReview(changed,assigned).join(' '),/inputs changed since confirmation/);
  }
  assert.match(assignmentReview({...order,dueHours:40},assigned).join(' '),/misses the current deadline by 9h/);
  assert.match(assignmentReview({...order,quantity:42},assigned).join(' '),/no longer feasible/);
  assert.equal(orderStatus(order,{[order.id]:assigned}),'planned');
});

test('changed unconfirmed order cannot retain its previous on-track status',()=>{
  const order=orders[1];assert.equal(order.state,'production');
  assert.equal(orderStatus({...order,quantity:100},{},false),'action');
  assert.equal(orderStatus({...order,dueHours:1},{},false),'action');
  assert.equal(orderStatus(order,{},false),'production');
});

test('invalid scenario inputs cannot enter the planner',()=>{
  for(const quantity of [0,-1,12.5,NaN,501])assert.throws(()=>createPlans({...orders[0],quantity}),RangeError);
  for(const dueHours of [0,-1,1.5,Infinity,337])assert.throws(()=>createPlans({...orders[0],dueHours}),RangeError);
});
