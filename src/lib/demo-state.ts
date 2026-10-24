import { orders } from '../data/network';
import type { Assignment } from './planner';
import { validScenario, type Scenarios } from './scenario';

export type DemoEvent = { id: string; text: string; detail: string; time: string };
export type DemoState = {
  assignments: Record<string, Assignment>;
  scenarios: Scenarios;
  disrupted: boolean;
  events: DemoEvent[];
};
export const STORAGE = 'forma-demo-v1';
// oxlint-disable-next-line anti-slop/no-unknown-parameters, anti-slop/no-unsafe-dictionary-type, anti-slop/no-runtime-typeof -- JSON.parse is the storage boundary; this guard exposes only a record, and each stored field is validated below before entering DemoState.
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

// Keep compatible saved decisions, including the original version's confirmations.
// Discard only invalid entries rather than losing every order because one entry is stale.
export function parseDemoState(raw: string | null): DemoState {
  const state: DemoState = { assignments: {}, scenarios: {}, disrupted: false, events: [] };
  try {
    const saved: unknown = JSON.parse(raw || 'null');
    if (!record(saved)) return state;
    state.disrupted = saved.disrupted === true;
    if (record(saved.scenarios)) {
      for (const order of orders) {
        const input = saved.scenarios[order.id];
        if (validScenario(input)) state.scenarios[order.id] = { quantity: input.quantity, dueHours: input.dueHours };
      }
    }
    if (record(saved.assignments)) {
      for (const order of orders) {
        const input = saved.assignments[order.id];
        if (!record(input) || input.orderId !== order.id) continue;
        const planId = input.planId;
        if (planId !== 'economy' && planId !== 'balanced' && planId !== 'express') continue;
        // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Reject invalid primitive types and non-finite or negative values from browser storage before constructing an Assignment.
        if (typeof input.cost !== 'number' || !Number.isFinite(input.cost) || input.cost < 0 || typeof input.etaHours !== 'number' || !Number.isFinite(input.etaHours) || input.etaHours < 0 || typeof input.assignedAt !== 'string') continue;
        const snapshot = { quantity: input.quantity ?? order.quantity, dueHours: input.dueHours ?? order.dueHours };
        if (!validScenario(snapshot)) continue;
        state.assignments[order.id] = { orderId: order.id, planId, cost: input.cost, etaHours: input.etaHours, assignedAt: input.assignedAt, ...snapshot };
      }
    }
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- All four required event fields must be strings before a stored event enters DemoState.
    if (Array.isArray(saved.events)) state.events = saved.events.filter((event): event is DemoEvent => record(event) && ['id', 'text', 'detail', 'time'].every(key => typeof event[key] === 'string'));
  } catch { /* Invalid browser storage starts with a clean demo. */ }
  return state;
}
