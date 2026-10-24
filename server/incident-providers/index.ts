import { gunzipSync } from "node:zlib"
import type { IncidentSourceId } from "../../src/lib/live-incidents"
import {
  parseAutobahn,
  parseEonet,
  parseGdacs,
  parseNdw,
  parsePortWatch,
  PROVIDER_URLS,
  type ProviderBatch,
} from "./parsers"

export type IncidentProvider = {
  id: IncidentSourceId
  name: string
  url: string
  intervalSeconds: number
  historical?: boolean
  load: (now: Date) => Promise<ProviderBatch>
}

// Deadlines apply to the response body as well as connection establishment.
// Upstream URLs are fixed here; request parameters cannot turn this into a proxy.
export async function boundedFetch(
  url: string,
  options: {
    maxBytes?: number
    timeoutMs?: number
    fetcher?: typeof fetch
  } = {}
): Promise<Buffer> {
  const limit = options.maxBytes ?? 4_000_000
  const signal = AbortSignal.timeout(options.timeoutMs ?? 12_000)
  const response = await (options.fetcher ?? fetch)(url, {
    signal,
    cache: "no-store",
    headers: {
      Accept: "application/json, application/xml, application/gzip, */*",
      "User-Agent": "FORMA-incident-workspace/1.0",
    },
  })
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error(`Provider returned HTTP ${response.status}`)
  }
  const length = Number(response.headers.get("content-length"))
  if (Number.isFinite(length) && length > limit) {
    await response.body?.cancel()
    throw new Error("Provider response exceeds byte limit")
  }
  if (!response.body)
    throw new Error("Provider returned an empty response body")
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = []
  let received = 0
  try {
    while (true) {
      signal.throwIfAborted()
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      if (received > limit)
        throw new Error("Provider response exceeds byte limit")
      chunks.push(value)
    }
  } catch (error) {
    await reader.cancel().catch(() => {})
    throw error
  } finally {
    reader.releaseLock()
  }
  return Buffer.concat(chunks)
}
// oxlint-disable-next-line anti-slop/no-unknown-returns -- Raw provider JSON is consumed immediately by the source-specific boundary parser below.
async function json(url: string): Promise<unknown> {
  return JSON.parse((await boundedFetch(url)).toString("utf8"))
}

export const incidentProviders: IncidentProvider[] = [
  {
    id: "gdacs",
    name: "GDACS",
    url: "https://www.gdacs.org/",
    intervalSeconds: 360,
    async load(now) {
      const url = new URL(PROVIDER_URLS.gdacs)
      url.search = new URLSearchParams({
        fromDate: new Date(now.getTime() - 7 * 86400_000)
          .toISOString()
          .slice(0, 10),
        toDate: now.toISOString().slice(0, 10),
        pageSize: "100",
        pageNumber: "1",
      }).toString()
      return parseGdacs(await json(url.href), now.toISOString())
    },
  },
  {
    id: "eonet",
    name: "NASA EONET",
    url: "https://eonet.gsfc.nasa.gov/",
    intervalSeconds: 600,
    async load(now) {
      return parseEonet(
        await json(`${PROVIDER_URLS.eonet}?limit=100&days=30&status=all`),
        now.toISOString()
      )
    },
  },
  {
    id: "autobahn",
    name: "Autobahn Germany · A2 / A24 / A10",
    url: "https://verkehr.autobahn.de/",
    intervalSeconds: 60,
    async load(now) {
      // All corridor endpoints must succeed before replacing the complete snapshot.
      const batches = await Promise.all((["A2", "A24", "A10"] as const).flatMap(road =>
        (["closure", "warning"] as const).map(async service => parseAutobahn(
          await json(`https://verkehr.autobahn.de/o/autobahn/${road}/services/${service}`), service, now.toISOString(), road
        ))
      ))
      return {
        incidents: batches.flatMap(batch => batch.incidents),
        message:
          "Germany A2, A24 and A10 corridors: closure notices and traffic warnings. Many closures affect entry/exit ramps. Provider geometries and restriction scope are preserved; proximity does not establish a blocked route.",
      }
    },
  },
  {
    id: "ndw",
    name: "NDW Netherlands",
    url: "https://opendata.ndw.nu/",
    intervalSeconds: 60,
    async load(now) {
      const body = await boundedFetch(PROVIDER_URLS.ndw, {
        maxBytes: 12_000_000,
      })
      // Some hosts transparently decompress HTTP gzip; the file may also be gzip.
      const xml =
        body[0] === 0x1f && body[1] === 0x8b
          ? gunzipSync(body, { maxOutputLength: 12_000_000 })
          : body
      return parseNdw(xml.toString("utf8"), now.toISOString())
    },
  },
  {
    id: "portwatch",
    name: "IMF PortWatch archive",
    url: "https://portwatch.imf.org/",
    intervalSeconds: 21_600,
    historical: true,
    async load(now) {
      const query = new URLSearchParams({
        f: "json",
        where: "1=1",
        outFields:
          "eventid,eventtype,eventname,htmlname,htmldescription,alertlevel,country,fromdate,todate,severitytext,lat,long,editdate,n_affectedports",
        resultRecordCount: "200",
        orderByFields: "fromdate DESC",
        returnGeometry: "false",
      })
      return parsePortWatch(
        await json(`${PROVIDER_URLS.portwatch}/query?${query}`),
        now.toISOString()
      )
    },
  },
]
