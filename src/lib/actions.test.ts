import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orders } from '../data/network';
import { requiredActions } from './actions';
import { createPlans, recommendedPlan, type Assignment, type PlanId } from './planner';

function assignment(order = orders[0], id: PlanId = 'balanced'): Assignment {
  const plan = createPlans(order).find(plan => plan.id === id)!;
  return { orderId: order.id, planId: id, cost: plan.totalCost, etaHours: plan.etaHours, quantity: order.quantity, dueHours: order.dueHours, assignedAt: '2026-10-24T10:00:00Z' };
}
test('baseline attention lists only the three affected orders with concrete reasons', () => {
  const actions = requiredActions(orders, {});
  assert.equal(actions.length, 3);
  assert.equal(actions[0].order.id, 'FM-2041');
  assert.equal(actions.find(action => action.order.id === 'FM-2048')?.reason, 'Current delivery is 12h late');
  assert.ok(actions.every(action => action.nextStep && action.detail));
});
test('a valid plan clears attention; late and disrupted confirmations remain actionable', () => {
  const order = orders[0];
  assert.deepEqual(requiredActions([order], { [order.id]: assignment() }), []);
  assert.match(requiredActions([order], { [order.id]: assignment(order, 'economy') })[0].reason, /12h late/);
  const delayed = requiredActions([order], { [order.id]: assignment() }, true)[0];
  assert.match(delayed.reason, /13h late/);
  assert.equal(delayed.nextStep, 'Recover order');
});
test('changed confirmations route the operator to the relevant next decision', () => {
  const confirmations = { [orders[0].id]: assignment() };
  const changed = requiredActions([{ ...orders[0], quantity: 20 }], confirmations)[0];
  assert.equal(changed.reason, 'Confirmation needs review');
  const unavailable = requiredActions([{ ...orders[0], quantity: 42 }], confirmations)[0];
  assert.equal(unavailable.reason, 'Confirmed route is infeasible');
  assert.equal(unavailable.nextStep, 'Replace plan');
  const noCapacity = requiredActions([{ ...orders[0], quantity: 49 }], confirmations)[0];
  assert.equal(noCapacity.target, 'inputs');
  assert.equal(noCapacity.nextStep, 'Adjust quantity');
  const noDeadline = requiredActions([{ ...orders[0], dueHours: 33 }], confirmations)[0];
  assert.equal(noDeadline.target, 'inputs');
  assert.match(noDeadline.detail, /1h late/);
});
test('all action orders can be resolved without suppressing or dismissing a warning', () => {
  const assignments = Object.fromEntries(orders.filter(order => order.state === 'action').map(order => [order.id, assignment(order, recommendedPlan(createPlans(order))!.id)]));
  assert.deepEqual(requiredActions(orders, assignments), []);
});
