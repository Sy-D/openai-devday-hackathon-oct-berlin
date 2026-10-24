import { parseRouteRequest, roadRouter, RouteInputError, RoutingUnavailableError } from "@/server/road-routing"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" }
  const origin = request.headers.get("origin")
  if (origin) {
    try {
      const target = new URL(request.url), host = request.headers.get("host")
      if (host) {
        if (/[\\/?#@,\s]/.test(host)) throw new Error("Invalid host")
        target.host = host
      }
      if (origin !== target.origin) throw new Error("Different origin")
    } catch { return Response.json({ error: "Only same-origin browser requests are allowed." }, { status: 403, headers }) }
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) return Response.json({ error: "Send application/json." }, { status: 415, headers })
  if (!request.body || Number(request.headers.get("content-length")) > 8000) return Response.json({ error: "Request must be at most 8 KB." }, { status: 413, headers })
  const reader = request.body.getReader(), chunks: Uint8Array[] = []
  let bytes = 0, timeout: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new RouteInputError("Request body timed out.")), 5000) })
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline])
      if (done) break
      bytes += value.byteLength
      if (bytes > 8000) return Response.json({ error: "Request must be at most 8 KB." }, { status: 413, headers })
      chunks.push(value)
    }
    clearTimeout(timeout)
    const input = parseRouteRequest(JSON.parse(Buffer.concat(chunks).toString("utf8")))
    return Response.json(await roadRouter.route(input), { headers })
  } catch (error) {
    if (error instanceof RouteInputError || error instanceof SyntaxError) return Response.json({ error: error instanceof RouteInputError ? error.message : "Request must contain valid JSON." }, { status: 400, headers })
    return Response.json({ error: error instanceof RoutingUnavailableError ? error.message : "Routing is unavailable. Try again shortly." }, { status: 502, headers })
  } finally { clearTimeout(timeout); void reader.cancel().catch(() => {}); reader.releaseLock() }
}
