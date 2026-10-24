import { orders, type Order } from '../data/network';

export type ScenarioInputs = { quantity: number; dueHours: number };
export type Scenarios = Record<string, ScenarioInputs>;
export const scenarioLimits = { quantity: { min: 1, max: 500 }, dueHours: { min: 1, max: 336 } };

export function validScenario(value: unknown): value is ScenarioInputs {
  if (!value || typeof value !== 'object') return false;
  const input = value as ScenarioInputs;
  return (Object.keys(scenarioLimits) as (keyof ScenarioInputs)[]).every(key =>
    Number.isInteger(input[key]) && input[key] >= scenarioLimits[key].min && input[key] <= scenarioLimits[key].max,
  );
}

export function scenarioChanged(order: Order): boolean {
  const original = orders.find(item => item.id === order.id);
  return !!original && (order.quantity !== original.quantity || order.dueHours !== original.dueHours);
}

export function scenarioOrders(scenarios: Scenarios): Order[] {
  return orders.map(order => {
    const input = scenarios[order.id];
    if (!input || !validScenario(input)) return order;
    return { ...order, ...input, value: Math.round(order.value * input.quantity / order.quantity) };
  });
}
