import { answerRequest, DEFAULT_MODEL, InputError, validateRequest, type AssistantOptions, type AssistantRequest, type AssistantResponse, type AssistantHealth } from './assistant';

const MAX_BODY_BYTES = 96 * 1024;
const json = (status: number, body: AssistantResponse) => Response.json(body, {
  status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});

function originError(request: Request): Response | undefined {
  const origin = request.headers.get('origin');
  if (!origin) return;
  try {
    let target = new URL(request.url);
    const host = request.headers.get('host');
    // Next normalizes loopback URL hostnames to localhost. Use the actual HTTP
    // Host authority, while retaining the transport scheme already resolved by
    // Next (including HTTPS behind Vercel). Do not trust forwarded host headers.
    if (host !== null) {
      if (!host || /[\\/?#@,\s]/.test(host)) throw new Error('Invalid Host.');
      const authority = new URL(`${target.protocol}//${host}`);
      if (!authority.hostname || authority.username || authority.password || authority.pathname !== '/' || authority.search || authority.hash) throw new Error('Invalid Host.');
      target = authority;
    }
    const source = new URL(origin);
    if ((target.protocol === 'http:' || target.protocol === 'https:') && source.origin === origin && source.origin === target.origin) return;
  } catch { /* Reject malformed origins without exposing their contents. */ }
  return json(403, { error: 'Only same-origin browser requests are allowed.' });
}

async function readBody(request: Request): Promise<AssistantRequest> {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) throw new InputError('Request is too large.');
  if (!request.body) throw new InputError('Request must contain valid JSON.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new InputError('Request body timed out.')), 10_000);
  });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) throw new InputError('Request is too large.');
      chunks.push(value);
    }
    const combined = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength; }
    let input: unknown;
    try { input = JSON.parse(new TextDecoder().decode(combined)); }
    catch { throw new InputError('Request must contain valid JSON.'); }
    return validateRequest(input);
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
  }
}

/** Web-standard adapters for the same validated assistant used by the local HTTP server. */
export function createProductionApi(options: AssistantOptions = {}) {
  let providerStatus: 'unverified' | 'verified' | 'unavailable' = 'unverified';
  let activeRequests = 0;
  return {
    health(request: Request): Response {
      const forbidden = originError(request);
      if (forbidden) return forbidden;
      const configured = Boolean(options.apiKey?.trim());
      const health: AssistantHealth = {
        mode: configured ? 'live' : 'demo',
        ready: configured && providerStatus === 'verified',
        status: configured ? providerStatus : 'not_configured',
      };
      if (configured) health.model = options.model || DEFAULT_MODEL;
      return json(200, health);
    },
    async assistant(request: Request): Promise<Response> {
      const forbidden = originError(request);
      if (forbidden) return forbidden;
      if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return json(415, { error: 'Send application/json.' });
      if (activeRequests >= 4) return json(429, { error: 'The assistant is busy. Try again in a moment.' });
      activeRequests += 1;
      try {
        const input = await readBody(request);
        const result = await answerRequest(input, options);
        if (options.apiKey?.trim()) providerStatus = result.mode === 'live' ? 'verified' : 'unavailable';
        return json(200, result);
      } catch (error) {
        const tooLarge = error instanceof InputError && error.message === 'Request is too large.';
        return json(tooLarge ? 413 : error instanceof InputError ? 400 : 500, {
          error: error instanceof InputError ? error.message : 'The assistant could not handle this request.',
        });
      } finally { activeRequests -= 1; }
    },
  };
}

// Routes may be compiled separately. Share readiness only within this Node process;
// a new process or serverless instance correctly begins unverified.
// SAFETY: this optional slot is initialized only with createProductionApi; missing state is handled below.
const processState = globalThis as typeof globalThis & { formaProductionApi?: ReturnType<typeof createProductionApi> };
export function productionApi() {
  return processState.formaProductionApi ??= createProductionApi({
    apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL,
  });
}
