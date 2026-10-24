import assert from 'node:assert/strict';
import test from 'node:test';
import { createProductionApi } from './production-api';
import { factories, orders } from '../src/data/network';
import { createPlans } from '../src/lib/planner';

const origin = 'https://forma.example';
const fixture = () => ({
  message: 'Which feasible plan meets the deadline at the lowest cost?',
  context: { order: orders[0], plans: createPlans(orders[0]), factories, selectedPlanId: 'balanced' },
});
const post = (body: unknown = fixture(), headers: Record<string, string> = {}) => new Request(`${origin}/api/assistant`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...headers }, body: JSON.stringify(body),
});
const health = () => new Request(`${origin}/api/health`, { headers: { Origin: origin } });
const providerReply = () => new Response(JSON.stringify({ status: 'completed', output: [{ content: [{
  type: 'output_text', text: JSON.stringify({ reply: 'Review Balanced.', suggestedPlanId: 'balanced' }),
}] }] }), { status: 200 });

test('native routes return current demo advice and non-cached honest health', async () => {
  const api = createProductionApi();
  const status = api.health(health());
  assert.equal(status.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await status.json(), { mode: 'demo', ready: false, status: 'not_configured' });
  const response = await api.assistant(post());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.mode, 'demo');
  assert.equal(body.suggestedPlanId, 'balanced');
});

test('native routes accept same-origin requests and reject remote or malformed origins', async () => {
  const api = createProductionApi();
  for (const invalid of ['https://evil.example', 'https://forma.example.evil.example', 'null', 'not a URL']) {
    assert.equal((await api.assistant(post(fixture(), { Origin: invalid }))).status, 403);
    assert.equal(api.health(new Request(`${origin}/api/health`, { headers: { Origin: invalid } })).status, 403);
  }
  const noOrigin = post(); noOrigin.headers.delete('Origin');
  assert.equal((await api.assistant(noOrigin)).status, 200);
});

test('native routes use actual Host when Next normalizes loopback or an upstream hostname', async () => {
  const api = createProductionApi();
  const request = (url: string, origin: string, host: string) => new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, Host: host },
    body: JSON.stringify(fixture()),
  });
  assert.equal((await api.assistant(request('http://localhost:5174/api/assistant', 'http://127.0.0.1:5174', '127.0.0.1:5174'))).status, 200);
  assert.equal((await api.assistant(request('https://internal.example:3000/api/assistant', origin, 'forma.example'))).status, 200);
  assert.equal(api.health(new Request('http://localhost:5174/api/health', {
    headers: { Origin: 'http://127.0.0.1:5174', Host: '127.0.0.1:5174' },
  })).status, 200);
  for (const foreign of ['http://localhost:5174', 'http://127.0.0.1:5175', 'https://127.0.0.1:5174']) {
    assert.equal((await api.assistant(request('http://localhost:5174/api/assistant', foreign, '127.0.0.1:5174'))).status, 403);
  }
});

test('native origin checks reject malformed authorities and ignore forwarded host overrides', async () => {
  const api = createProductionApi();
  for (const host of ['forma.example/path', 'forma.example?query', 'forma.example#fragment', 'user@forma.example', 'forma.example,evil.example', 'forma.example:invalid', '']) {
    assert.equal((await api.assistant(post(fixture(), { Host: host }))).status, 403);
  }
  const forwarded = { Host: 'forma.example', 'X-Forwarded-Host': 'evil.example', Forwarded: 'host=evil.example;proto=http', 'X-Forwarded-Proto': 'http' };
  assert.equal((await api.assistant(post(fixture(), forwarded))).status, 200);
  assert.equal((await api.assistant(post(fixture(), { ...forwarded, Origin: 'https://evil.example' }))).status, 403);
  assert.equal((await api.assistant(post(fixture(), { Origin: `${origin}/path` }))).status, 403);
});

test('native body limits apply with and without content-length and reject invalid input', async () => {
  const api = createProductionApi();
  assert.equal((await api.assistant(post({}, { 'Content-Type': 'text/plain' }))).status, 415);
  assert.equal((await api.assistant(post({ message: 'hello' }))).status, 400);
  assert.equal((await api.assistant(post(fixture(), { 'Content-Length': String(97 * 1024) }))).status, 413);
  assert.equal((await api.assistant(post({ message: 'x'.repeat(97 * 1024) }))).status, 413);
  assert.equal((await api.assistant(new Request(`${origin}/api/assistant`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{invalid',
  }))).status, 400);
});

test('validated replies update process readiness, and provider failure clears it without leaking details', async () => {
  let calls = 0;
  const api = createProductionApi({ apiKey: 'private-test-key', fetchImpl: async () => ++calls === 1
    ? providerReply() : new Response('private-test-key and upstream details', { status: 401 }) });
  assert.equal((await api.health(health()).json()).status, 'unverified');
  assert.equal((await (await api.assistant(post())).json()).mode, 'live');
  assert.equal((await api.health(health()).json()).ready, true);
  const fallback = await (await api.assistant(post())).json();
  assert.equal(fallback.mode, 'demo');
  assert.ok(!JSON.stringify(fallback).includes('private-test-key'));
  assert.equal((await api.health(health()).json()).status, 'unavailable');
  assert.equal((await api.health(health()).json()).ready, false);
});

test('native route caps concurrent provider work and releases slots after completion', async () => {
  const releases: (() => void)[] = [];
  const api = createProductionApi({ apiKey: 'test-key', fetchImpl: async () => {
    await new Promise<void>(resolve => releases.push(resolve));
    return providerReply();
  } });
  const pending = Array.from({ length: 4 }, () => api.assistant(post()));
  assert.equal((await api.assistant(post())).status, 429);
  while (releases.length < 4) await new Promise(resolve => setTimeout(resolve, 1));
  releases.splice(0).forEach(release => release());
  assert.ok((await Promise.all(pending)).every(response => response.status === 200));
  const next = api.assistant(post());
  while (!releases.length) await new Promise(resolve => setTimeout(resolve, 1));
  releases.splice(0).forEach(release => release());
  assert.equal((await next).status, 200);
});
