import test from 'node:test';
import assert from 'node:assert/strict';
import {orders} from '../data/network';
import {createPlans,orderStatus} from './planner';
import {parseDemoState} from './demo-state';
import {scenarioOrders,validScenario} from './scenario';

test('scenario changes only its order and updates the mock volume value',()=>{
  const changed=scenarioOrders({[orders[0].id]:{quantity:24,dueHours:40}});
  assert.equal(changed[0].quantity,24);assert.equal(changed[0].dueHours,40);
  assert.equal(changed[0].value,orders[0].value*2);
  assert.deepEqual(changed.slice(1),orders.slice(1));
  assert.equal(orders[0].quantity,12);
  assert.equal(validScenario({quantity:24.5,dueHours:40}),false);
});

test('old saved confirmations keep their original inputs when migrating',()=>{
  const plan=createPlans(orders[0]).find(p=>p.id==='balanced')!;
  const state=parseDemoState(JSON.stringify({assignments:{[orders[0].id]:{orderId:orders[0].id,planId:plan.id,cost:plan.totalCost,etaHours:plan.etaHours,assignedAt:'test'}},disrupted:false,events:[]}));
  assert.equal(state.assignments[orders[0].id].quantity,12);
  assert.equal(state.assignments[orders[0].id].dueHours,60);
  assert.equal(orderStatus(orders[0],state.assignments),'planned');
});

test('saved scenario and confirmed snapshot stay distinct after reload',()=>{
  const plan=createPlans(orders[0]).find(p=>p.id==='balanced')!;
  const state=parseDemoState(JSON.stringify({assignments:{[orders[0].id]:{orderId:orders[0].id,planId:plan.id,cost:plan.totalCost,etaHours:plan.etaHours,assignedAt:'test',quantity:12,dueHours:60}},scenarios:{[orders[0].id]:{quantity:42,dueHours:60}},disrupted:false,events:[]}));
  assert.equal(scenarioOrders(state.scenarios)[0].quantity,42);
  assert.equal(state.assignments[orders[0].id].quantity,12);
  assert.equal(orderStatus(scenarioOrders(state.scenarios)[0],state.assignments),'action');
});

test('invalid saved scenarios are discarded without losing valid orders',()=>{
  const scenarios={[orders[0].id]:{quantity:5000,dueHours:60},[orders[1].id]:{quantity:10,dueHours:90},unknown:{quantity:10,dueHours:40}};
  const state=parseDemoState(JSON.stringify({scenarios,assignments:{bad:null},events:[null],disrupted:false}));
  assert.deepEqual(state.scenarios,{[orders[1].id]:{quantity:10,dueHours:90}});
  assert.deepEqual(state.assignments,{});
  assert.deepEqual(state.events,[]);
  assert.deepEqual(parseDemoState('broken'),{assignments:{},scenarios:{},disrupted:false,events:[]});
});
