import type { Order } from '../data/network';
import { createPlans, orderStatus, recommendedPlan, type Assignment } from './planner';
import { scenarioChanged } from './scenario';

export type OrderAction = {
  order: Order;
  reason: string;
  detail: string;
  nextStep: string;
  target: 'inputs' | 'plans';
  severity: number;
};

/** One actionable summary per order, derived from the same state as its planner. */
export function requiredActions(orders: Order[], assignments: Record<string, Assignment>, disrupted = false): OrderAction[] {
  return orders.filter(order => orderStatus(order, assignments, disrupted) === 'action').map(order => {
    const plans = createPlans(order, disrupted);
    const feasible = plans.filter(plan => plan.feasible);
    const assigned = assignments[order.id];
    const confirmed = plans.find(plan => plan.id === assigned?.planId);
    const recommendation = recommendedPlan(plans);
    const base = { order, target: 'plans' as const, nextStep: 'Compare routes' };
    if (!feasible.length) return { ...base, severity: 0, reason: 'No route has capacity', detail: `${order.quantity} kits exceed the available production or assembly capacity. Reduce quantity to continue.`, nextStep: 'Adjust quantity', target: 'inputs' as const };
    if (!recommendation) {
      const earliest = Math.min(...feasible.map(plan => plan.etaHours));
      return { ...base, severity: 1, reason: 'Deadline cannot be met', detail: `The earliest feasible delivery is ${earliest - order.dueHours}h late. Extend the deadline or review a late plan.`, nextStep: 'Review deadline', target: 'inputs' as const };
    }
    if (confirmed && !confirmed.feasible) return { ...base, severity: 0, reason: 'Confirmed route is infeasible', detail: `${confirmed.name} exceeds current capacity. ${recommendation.name} can deliver with ${recommendation.bufferHours}h to spare.`, nextStep: 'Replace plan' };
    if (confirmed && confirmed.bufferHours < 0) return { ...base, severity: 1, reason: `Confirmed delivery is ${-confirmed.bufferHours}h late`, detail: `${confirmed.name} misses the current deadline. Review ${recommendation.name} to recover this order.`, nextStep: 'Recover order' };
    if (assigned) return { ...base, severity: 2, reason: 'Confirmation needs review', detail: 'Order inputs or production estimates changed. Review the updated costs and delivery before reconfirming.', nextStep: 'Review changes' };
    if (scenarioChanged(order)) return { ...base, severity: 2, reason: 'Scenario needs a plan', detail: `${order.quantity} kits are due in ${order.dueHours}h. ${recommendation.name} is the cheapest available on-time route.`, nextStep: 'Review scenario' };
    const delay = Math.max(0, order.baselineEta - order.dueHours);
    return { ...base, severity: 1, reason: delay ? `Current delivery is ${delay}h late` : 'Production plan needs review', detail: `${order.name} · ${order.quantity} kits due in ${order.dueHours}h. Compare an on-time replacement.` };
  }).sort((a, b) => a.severity - b.severity || Number(b.order.priority === 'Critical') - Number(a.order.priority === 'Critical') || a.order.dueHours - b.order.dueHours);
}
