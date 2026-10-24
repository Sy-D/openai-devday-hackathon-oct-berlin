import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { loadEnvFile } from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createAssistantServer } from '../server/index';
import { validateRequest, type AssistantOptions } from '../server/assistant';
import { factories, orders } from '../src/data/network';
import { createPlans, recommendedPlan } from '../src/lib/planner';

type SmokeResult = { exitCode: 0 | 1 | 2; message: string };

/** One real provider request through the retained HTTP adapter and shared assistant core. */
export async function verifyLiveAssistant(options: AssistantOptions): Promise<SmokeResult> {
  if (!options.apiKey?.trim()) return {
    exitCode: 2,
    message: 'NOT CONFIGURED: set OPENAI_API_KEY in the project .env or server environment. No provider request was sent.',
  };
  const server = createAssistantServer(options);
  try {
    const order = orders.find(order => order.id === 'FM-2048');
    if (!order) throw new Error('Missing demo order.');
    const plans = createPlans(order);
    const expected = recommendedPlan(plans);
    if (!expected) throw new Error('Missing on-time demo plan.');
    const request = validateRequest({
      message: 'Which feasible plan meets the deadline at the lowest total cost? Explain briefly and suggest that plan.',
      context: { order, plans, factories, selectedPlanId: expected.id },
    });

    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    // SAFETY: the listening event follows a TCP listen call with a numeric port, so address is AddressInfo.
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const initial = await (await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(5_000) })).json();
    if (initial.ready !== false || initial.status !== 'unverified') throw new Error('Initial readiness was incorrect.');
    const response = await fetch(`${base}/api/assistant`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request), signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error('Assistant endpoint rejected the request.');
    const reply = await response.json();
    if (reply.mode !== 'live') return {
      exitCode: 1,
      message: 'FAILED: the provider request returned demo fallback. Check server credentials, model access and connectivity. Live AI is not verified.',
    };
    if (reply.suggestedPlanId !== expected.id) return {
      exitCode: 1,
      message: 'FAILED: the provider replied, but did not suggest the cheapest feasible on-time plan from the current scenario. Live planning advice is not verified.',
    };
    const health = await (await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(5_000) })).json();
    if (health.mode !== 'live' || health.ready !== true || health.status !== 'verified') throw new Error('Verified readiness was not recorded.');
    return {
      exitCode: 0,
      message: `PASS: a validated live provider reply suggested ${expected.name} for ${order.id}; the HTTP server changed from unverified to verified. No order was changed.`,
    };
  } catch {
    // Do not echo upstream error text, request bodies or environment values.
    return { exitCode: 1, message: 'FAILED: live verification could not complete. No live success is claimed; check configuration and connectivity, then rerun.' };
  } finally {
    if (server.listening) {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let envReady = true;
  try { loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url))); }
  catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
      envReady = false;
      console.error('FAILED: the project .env could not be loaded. No provider request was sent.');
      process.exitCode = 2;
    }
  }
  if (envReady) {
    const result = await verifyLiveAssistant({ apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL });
    (result.exitCode ? console.error : console.log)(result.message);
    process.exitCode = result.exitCode;
  }
}
