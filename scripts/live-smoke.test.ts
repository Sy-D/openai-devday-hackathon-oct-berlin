import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyLiveAssistant } from './live-smoke';

const providerReply = (suggestedPlanId: string) => new Response(JSON.stringify({
  status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({
    reply: 'Review the suggested plan before confirming.', suggestedPlanId,
  }) }] }],
}), { status: 200 });

test('missing credentials fail without calling the provider', async () => {
  const result = await verifyLiveAssistant({ fetchImpl: async () => { throw new Error('Must not call provider'); } });
  assert.equal(result.exitCode, 2);
  assert.match(result.message, /NOT CONFIGURED/);
});

test('success exercises the real HTTP contract and current planner data', async () => {
  let calls = 0;
  const result = await verifyLiveAssistant({ apiKey: 'smoke-test-key', model: 'test-model', fetchImpl: async (url, init) => {
    calls += 1;
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const payload = JSON.parse(String(init?.body));
    const request = JSON.parse(payload.input[0].content);
    assert.equal(request.context.order.id, 'FM-2048');
    assert.equal(request.context.order.quantity, 12);
    assert.equal(request.context.plans.find((plan: { id: string }) => plan.id === 'balanced').totalCost, 3222);
    assert.equal(payload.model, 'test-model');
    assert.equal(payload.store, false);
    assert.ok(!String(init?.body).includes('smoke-test-key'));
    return providerReply('balanced');
  } });
  assert.equal(calls, 1);
  assert.equal(result.exitCode, 0);
  assert.match(result.message, /unverified to verified/);
  assert.ok(!result.message.includes('smoke-test-key'));
});

test('provider fallback and malformed suggestions cannot pass the smoke check', async () => {
  for (const response of [new Response('secret provider detail', { status: 401 }), providerReply('invented-route')]) {
    const result = await verifyLiveAssistant({ apiKey: 'smoke-test-key', fetchImpl: async () => response });
    assert.equal(result.exitCode, 1);
    assert.match(result.message, /demo fallback/);
    assert.ok(!result.message.includes('secret provider detail'));
    assert.ok(!result.message.includes('smoke-test-key'));
  }
});

test('a valid but incorrect cheapest-on-time recommendation does not pass', async () => {
  const result = await verifyLiveAssistant({ apiKey: 'smoke-test-key', fetchImpl: async () => providerReply('economy') });
  assert.equal(result.exitCode, 1);
  assert.match(result.message, /did not suggest the cheapest feasible on-time plan/);
});
