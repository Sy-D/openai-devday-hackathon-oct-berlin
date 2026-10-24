import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { loadEnvFile } from 'node:process';
import { pathToFileURL } from 'node:url';
import { answerRequest, DEFAULT_MODEL, InputError, validateRequest, type AssistantOptions } from './assistant';

const MAX_BODY_BYTES = 96 * 1024;
const json = (response: ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(body));
};
async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > MAX_BODY_BYTES) throw new InputError('Request is too large.');
    chunks.push(Buffer.from(chunk));
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new InputError('Request must contain valid JSON.'); }
}

export function createAssistantServer(options: AssistantOptions = {}) {
  let providerStatus: 'unverified' | 'verified' | 'unavailable' = 'unverified';
  let activeRequests = 0;
  return createServer(async (request, response) => {
    const route = request.url?.split('?')[0];
    // A local endpoint should not accept browser requests made by a remote website.
    const origin = request.headers.origin;
    if (origin) {
      try { if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname)) { json(response, 403, { error: 'Only local browser origins are allowed.' }); return; } }
      catch { json(response, 403, { error: 'Invalid request origin.' }); return; }
    }
    if (route === '/api/health' && request.method === 'GET') {
      const configured = Boolean(options.apiKey?.trim());
      json(response, 200, { mode: configured ? 'live' : 'demo', ready: configured && providerStatus === 'verified', status: configured ? providerStatus : 'not_configured', ...(configured ? { model: options.model || DEFAULT_MODEL } : {}) });
      return;
    }
    if (route !== '/api/assistant') { json(response, 404, { error: 'Route not found.' }); return; }
    if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); json(response, 405, { error: 'Use POST for assistant requests.' }); return; }
    if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) { json(response, 415, { error: 'Send application/json.' }); return; }
    if (Number(request.headers['content-length'] ?? 0) > MAX_BODY_BYTES) { json(response, 413, { error: 'Request is too large.' }); return; }
    if (activeRequests >= 4) { json(response, 429, { error: 'The assistant is busy. Try again in a moment.' }); return; }
    activeRequests += 1;
    try {
      const body = validateRequest(await readBody(request));
      const result = await answerRequest(body, options);
      if (options.apiKey?.trim()) providerStatus = result.mode === 'live' ? 'verified' : 'unavailable';
      json(response, 200, result);
    } catch (error) {
      const tooLarge = error instanceof InputError && error.message === 'Request is too large.';
      json(response, tooLarge ? 413 : error instanceof InputError ? 400 : 500, { error: error instanceof InputError ? error.message : 'The assistant could not handle this request.' });
    } finally { activeRequests -= 1; }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { loadEnvFile('.env'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const port = Number(process.env.API_PORT || 8789);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('API_PORT must be a valid port number.');
  const server = createAssistantServer({ apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL });
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  server.listen(port, '127.0.0.1', () => {
    console.log(`Forma assistant: http://127.0.0.1:${port} (${process.env.OPENAI_API_KEY?.trim() ? 'OpenAI configured; connection unverified' : 'demo mode'})`);
  });
}
