import { cached } from "@/lib/cache"

const HOST_PATTERN = /https:\/\/([a-z0-9.-]*openfreemap\.org)/g
const TTL = 60 * 60 * 24 * 7

/**
 * Proxies OpenFreeMap style JSON, vector tiles, glyphs and sprites through a
 * shared cache so repeated map mounts and page loads don't hit the CDN.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const hasHost = path[0].includes(".")
  const host = hasHost ? path[0] : "tiles.openfreemap.org"
  const upstreamPath = hasHost ? path.slice(1).join("/") : path.join("/")
  if (!/^(?:[a-z0-9-]+\.)*openfreemap\.org$/.test(host) || upstreamPath.length > 2000)
    return new Response("Unsupported map source", { status: 400 })

  try {
    // Cache the raw upstream payload — URL rewriting happens per request so a
    // style cached under one origin never leaks it to another deployment.
    const payload = await cached(`tile2:${host}/${upstreamPath}`, TTL, async () => {
      const response = await fetch(`https://${host}/${upstreamPath}`, {
        headers: { "User-Agent": "FORMA-DeliveryPlanner/1.0" },
        signal: AbortSignal.timeout(10_000),
      })
      if (!response.ok) throw new Error(`upstream ${response.status}`)
      const type = response.headers.get("content-type") ?? ""
      if (type.includes("json")) {
        return { type, body: await response.text() }
      }
      const buffer = Buffer.from(await response.arrayBuffer())
      return { type, body: buffer.toString("base64") }
    })

    const isJson = payload.type.includes("json")
    let body = payload.body
    if (isJson) {
      // Behind a reverse proxy request.url is the internal origin
      // (http://localhost:3000) — trust the forwarded headers instead.
      const proto =
        request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ??
        new URL(request.url).protocol.replace(":", "")
      const publicHost =
        request.headers.get("x-forwarded-host")?.split(",")[0].trim() ??
        request.headers.get("host") ??
        new URL(request.url).host
      const origin = `${proto}://${publicHost}`
      body = body.replace(
        HOST_PATTERN,
        (_match, h: string) => `${origin}/api/map-proxy/${h}`
      )
    }
    return new Response(
      isJson ? body : Buffer.from(body, "base64"),
      {
        headers: {
          "Content-Type":
            payload.type ||
            (upstreamPath.endsWith(".pbf")
              ? "application/x-protobuf"
              : "application/octet-stream"),
          "Cache-Control": "public, max-age=86400",
        },
      }
    )
  } catch {
    return new Response("tile fetch failed", { status: 502 })
  }
}
