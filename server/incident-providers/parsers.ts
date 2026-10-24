// This module is the boundary for untrusted provider JSON/XML. Its primitive
// guards validate fields before constructing the exported LiveIncident contract.
/* oxlint-disable anti-slop/no-unknown-parameters, anti-slop/no-runtime-typeof, anti-slop/no-unsafe-dictionary-type */
import { XMLParser, XMLValidator } from "fast-xml-parser"
import type { LiveIncident } from "../../src/lib/live-incidents"

type Data = Record<string, unknown>
export type ProviderBatch = {
  incidents: LiveIncident[]
  message?: string
  stale?: boolean
}

export const PROVIDER_URLS = {
  gdacs: "https://www.gdacs.org/gdacsapi/api/Events/geteventlist/search",
  eonet: "https://eonet.gsfc.nasa.gov/api/v3/events",
  autobahn: "https://verkehr.autobahn.de/o/autobahn/A2/services/",
  ndw: "https://opendata.ndw.nu/actueel_beeld.xml.gz",
  portwatch:
    "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/ArcGIS/rest/services/portwatch_disruptions_database/FeatureServer/0",
} as const

function object(value: unknown): Data {
  // SAFETY: non-null, non-array objects are checked here; every field remains unknown until parsed.
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Data)
    : {}
}
function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value == null ? [] : [value]
}
function text(value: unknown, limit = 4000): string {
  if (typeof value === "string" || typeof value === "number")
    return String(value).trim().slice(0, limit)
  const nested = object(value)["#text"]
  return typeof nested === "string" || typeof nested === "number"
    ? String(nested).trim().slice(0, limit)
    : ""
}
function plain(value: unknown): string {
  return text(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
}
function bool(value: unknown): boolean {
  return value === true || value === "true"
}
export function date(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined
  if (typeof value !== "number" && typeof value !== "string") return undefined
  // GDACS publishes UTC dates without a zone suffix. Do not use the host timezone.
  const normalized =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}T[\d:.]+$/.test(value)
      ? `${value}Z`
      : value
  const stamp = new Date(normalized).getTime()
  return Number.isFinite(stamp) ? new Date(stamp).toISOString() : undefined
}
function coordinate(
  longitude: unknown,
  latitude: unknown
): [number, number] | undefined {
  if (
    longitude == null ||
    latitude == null ||
    longitude === "" ||
    latitude === ""
  )
    return undefined
  const lng = Number(longitude),
    lat = Number(latitude)
  return Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    Math.abs(lng) <= 180 &&
    Math.abs(lat) <= 90
    ? [lng, lat]
    : undefined
}
function point(value: unknown): [number, number] | undefined {
  const geo = object(value)
  return geo.type === "Point" && Array.isArray(geo.coordinates)
    ? coordinate(geo.coordinates[0], geo.coordinates[1])
    : undefined
}
function safeUrl(value: unknown, fallback: string): string {
  try {
    const url = new URL(text(value))
    return url.protocol === "https:" ? url.href : fallback
  } catch {
    return fallback
  }
}
function kind(code: unknown): LiveIncident["kind"] {
  const names = new Map<string, LiveIncident["kind"]>([
    ["EQ", "earthquake"],
    ["FL", "flood"],
    ["TC", "storm"],
    ["WF", "wildfire"],
    ["earthquakes", "earthquake"],
    ["floods", "flood"],
    ["severeStorms", "storm"],
    ["wildfires", "wildfire"],
  ])
  return names.get(text(code)) ?? "other"
}
function alertSeverity(value: unknown): LiveIncident["severity"] {
  const names = new Map<string, LiveIncident["severity"]>([
    ["red", "critical"],
    ["orange", "high"],
    ["green", "low"],
    ["high", "high"],
    ["medium", "medium"],
    ["low", "low"],
    ["highest", "critical"],
    ["lowest", "low"],
  ])
  return names.get(text(value).toLowerCase()) ?? "unknown"
}
function requiredArray(value: unknown, key: string): unknown[] {
  const data = object(value),
    rows = data[key]
  if (data.error || !Array.isArray(rows))
    throw new Error(`Provider response has no ${key} array`)
  return rows
}
function validRecords(
  records: LiveIncident[],
  rawCount: number
): LiveIncident[] {
  if (records.length !== rawCount)
    throw new Error("Provider response contained invalid incident identifiers")
  return [...new Map(records.map((record) => [record.id, record])).values()]
}

export function parseGdacs(input: unknown, fetchedAt: string): ProviderBatch {
  const rows = requiredArray(input, "features")
  const incidents = rows.flatMap((row) => {
    const feature = object(row),
      p = object(feature.properties)
    const eventId = text(p.eventid),
      eventType = text(p.eventtype)
    if (!eventId || !eventType) return []
    const providerId = `${eventType}:${eventId}`
    const startedAt = date(p.fromdate),
      endedAt = date(p.todate)
    const status: LiveIncident["status"] =
      startedAt && startedAt > fetchedAt
        ? "scheduled"
        : bool(p.iscurrent) && (!endedAt || endedAt >= fetchedAt)
          ? "active"
          : "unknown"
    const severity = alertSeverity(p.episodealertlevel ?? p.alertlevel)
    return [
      {
        id: `gdacs:${providerId}`,
        sourceId: "gdacs" as const,
        providerId,
        title: plain(p.name || p.eventname) || `${eventType} event ${eventId}`,
        description: [
          plain(p.description),
          plain(object(p.severitydata).severitytext),
          `Current episode alert: ${text(p.episodealertlevel || p.alertlevel) || "not reported"}. Event peak alert: ${text(p.alertlevel) || "not reported"}. Hazard report; a transport closure is not confirmed.`,
        ]
          .filter(Boolean)
          .join(" "),
        kind: kind(eventType),
        severity,
        status,
        country: text(p.country) || "Not reported",
        location: text(p.country) || "Location not reported",
        coordinates: point(feature.geometry),
        startedAt,
        endedAt,
        updatedAt: date(p.datemodified),
        fetchedAt,
        url: safeUrl(object(p.url).report, "https://www.gdacs.org/"),
        evidence: "hazard" as const,
        attribution: `GDACS${text(p.source) ? ` · ${text(p.source)}` : ""}`,
      },
    ]
  })
  return {
    incidents: validRecords(incidents, rows.length),
    message: `Worldwide hazard reports from the last 7 days; up to 100 events. Episode alert shown; not confirmed transport closures.${rows.length >= 100 ? " Result limit reached; coverage is partial." : ""}`,
  }
}

export function parseEonet(input: unknown, fetchedAt: string): ProviderBatch {
  const rows = requiredArray(input, "events")
  const incidents = rows.flatMap((row) => {
    const p = object(row),
      providerId = text(p.id)
    if (!providerId) return []
    const geometries = list(p.geometry)
      .map(object)
      .sort((a, b) => (date(a.date) ?? "").localeCompare(date(b.date) ?? ""))
    const latest = geometries.at(-1),
      first = geometries[0]
    const sources = list(p.sources).map(object)
    const endedAt = date(p.closed)
    return [
      {
        id: `eonet:${providerId}`,
        sourceId: "eonet" as const,
        providerId,
        title: plain(p.title) || providerId,
        description: [
          plain(p.description),
          "Natural-event observation; location is approximate and does not confirm a transport closure.",
        ]
          .filter(Boolean)
          .join(" "),
        kind: kind(object(list(p.categories)[0]).id),
        severity: "unknown" as const,
        status: endedAt
          ? ("resolved" as const)
          : p.closed === null
            ? ("active" as const)
            : ("unknown" as const),
        country: "Not reported",
        location: plain(p.title) || "Location not reported",
        coordinates: point(latest),
        startedAt: date(first?.date),
        endedAt,
        updatedAt: date(latest?.date),
        fetchedAt,
        url: safeUrl(sources[0]?.url, safeUrl(p.link, PROVIDER_URLS.eonet)),
        evidence: "hazard" as const,
        attribution: `NASA EONET${
          sources.length
            ? ` · ${sources
                .map((source) => text(source.id))
                .filter(Boolean)
                .join(", ")}`
            : ""
        }`,
      },
    ]
  })
  return {
    incidents: validRecords(incidents, rows.length),
    message: `Worldwide natural events observed within 30 days; up to 100 events. EONET can cite GDACS, so reports may overlap.${rows.length >= 100 ? " Result limit reached; coverage is partial." : ""}`,
  }
}

export function parseAutobahn(
  input: unknown,
  service: "closure" | "warning",
  fetchedAt: string,
  road: "A2" | "A24" | "A10" = "A2"
): ProviderBatch {
  const rows = requiredArray(input, service)
  const incidents = rows.flatMap((row) => {
    const p = object(row),
      providerId = text(p.identifier)
    if (!providerId) return []
    const ramp = p.display_type === "CLOSURE_ENTRY_EXIT",
      blocked = bool(p.isBlocked),
      startedAt = date(p.startTimestamp)
    const future = bool(p.future) || Boolean(startedAt && startedAt > fetchedAt)
    const scope = ramp
      ? "Entry/exit ramp restriction; not a whole-motorway closure."
      : blocked
        ? "Provider marks this road segment blocked."
        : service === "closure"
          ? "Provider closure notice; whole-motorway blockage is not confirmed."
          : "Provider traffic warning; whole-motorway blockage is not confirmed."
    return [
      {
        id: `autobahn:${road}:${service}:${providerId}`,
        sourceId: "autobahn" as const,
        providerId,
        title: `${road} ${ramp ? "ramp restriction" : service === "closure" ? "closure notice" : "traffic warning"}: ${plain(p.title) || providerId}`,
        description:
          `${scope} ${list(p.description).map(plain).filter(Boolean).join(" ")}`.slice(
            0,
            4000
          ),
        kind: "road" as const,
        severity: blocked ? ("high" as const) : ("unknown" as const),
        status: future ? ("scheduled" as const) : ("active" as const),
        country: "Germany",
        location: plain(p.subtitle) || plain(p.title) || road,
        coordinates: coordinate(
          object(p.coordinate).long,
          object(p.coordinate).lat
        ),
        geometry: roadGeometry(p.geometry),
        roadImpact: {
          road,
          scope: ramp ? "ramp" as const : service === "warning" ? "traffic-warning" as const : blocked ? "road" as const : "unknown" as const,
          restriction: service === "warning" ? "warning" as const : blocked || ramp ? "closed" as const : "restricted" as const,
          direction: plain(p.subtitle) || undefined,
        },
        startedAt,
        fetchedAt,
        url: `https://verkehr.autobahn.de/o/autobahn/${road}/services/${service}`,
        evidence: "reported-restriction" as const,
        attribution: `Autobahn Germany${text(p.source) ? ` · ${text(p.source)}` : ""}`,
      },
    ]
  })
  return { incidents: validRecords(incidents, rows.length) }
}

function roadGeometry(value: unknown): LiveIncident["geometry"] {
  const geo = object(value)
  if (geo.type !== "LineString" || !Array.isArray(geo.coordinates) || geo.coordinates.length < 2 || geo.coordinates.length > 2000) return undefined
  const points = geo.coordinates.map(value => Array.isArray(value) ? coordinate(value[0], value[1]) : undefined)
  if (points.some(value => value === undefined)) return undefined
  return { type: "LineString", coordinates: points.filter(value => value !== undefined) }
}

function ndwGeometry(record: unknown): LiveIncident["geometry"] {
  const lines = descendants(record, "posList").flatMap(value => {
    const values = text(value, 200_000).split(/\s+/).map(Number)
    if (values.length < 4 || values.length > 4000 || values.length % 2) return []
    const points: [number, number][] = []
    for (let i = 0; i < values.length; i += 2) {
      const point = coordinate(values[i + 1], values[i])
      if (!point) return []
      points.push(point)
    }
    return [points]
  })
  return lines.length === 1 ? { type: "LineString", coordinates: lines[0] } : lines.length ? { type: "MultiLineString", coordinates: lines } : undefined
}

// DATEX II has nested, namespaced location variants. Walk only the parsed tree,
// preserving latitude/longitude order explicitly rather than treating it as GeoJSON.
function descendants(value: unknown, name: string, depth = 0): unknown[] {
  if (depth > 35 || value === null || typeof value !== "object") return []
  if (Array.isArray(value))
    return value.flatMap((child) => descendants(child, name, depth + 1))
  return Object.entries(object(value)).flatMap(([key, child]) =>
    key === name ? list(child) : descendants(child, name, depth + 1)
  )
}
function firstText(value: unknown, name: string): string {
  return text(descendants(value, name)[0])
}
function human(value: string): string {
  return value
    .replace(/^\w+:/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/^./, (first) => first.toUpperCase())
}

export function parseNdw(xml: string, fetchedAt: string): ProviderBatch {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new Error("NDW XML declarations are not supported")
  if (XMLValidator.validate(xml) !== true)
    throw new Error("NDW XML is malformed")
  const parsed: unknown = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    parseTagValue: false,
    parseAttributeValue: false,
    processEntities: false,
  }).parse(xml)
  const payload = descendants(parsed, "payload")[0]
  if (
    text(object(payload)["@_type"]).split(":").at(-1) !==
      "SituationPublication" ||
    !firstText(payload, "publicationTime")
  )
    throw new Error("NDW response is not a situation publication")
  const publicationTime = date(firstText(payload, "publicationTime"))
  const situations = descendants(payload, "situation")
  const records: LiveIncident[] = []
  let rawCount = 0
  for (const situation of situations) {
    const severity = alertSeverity(object(situation).overallSeverity)
    for (const value of list(object(situation).situationRecord)) {
      rawCount += 1
      const record = object(value),
        providerId = text(record["@_id"])
      if (!providerId) continue
      const type = human(text(record["@_type"]))
      const managementType = [
        "roadOrCarriagewayOrLaneManagementType",
        "reroutingManagementType",
        "generalNetworkManagementType",
        "vehicleObstructionType",
        "generalObstructionType",
        "abnormalTrafficType",
        "accidentType",
        "speedManagementType",
      ]
        .map((key) => firstText(record, key))
        .find(Boolean)
      const startedAt = date(firstText(record, "overallStartTime")),
        endedAt = date(firstText(record, "overallEndTime"))
      const validity = firstText(record, "validityStatus"),
        probability = firstText(record, "probabilityOfOccurrence")
      const status: LiveIncident["status"] =
        validity === "suspended"
          ? "unknown"
          : startedAt && startedAt > fetchedAt
            ? "scheduled"
            : endedAt &&
                endedAt < fetchedAt &&
                !bool(firstText(record, "overrunning"))
              ? "resolved"
              : probability === "riskOf" || probability === "probable"
                ? "unknown"
                : "active"
      const coordinates = coordinate(
        firstText(record, "longitude"),
        firstText(record, "latitude")
      )
      const line = firstText(record, "posList").split(/\s+/)
      const source = descendants(record.source, "value")
        .map((value) => text(value))
        .filter(Boolean)
        .join(", ")
      const road = firstText(record, "roadNumber")
      const carriageway = firstText(record, "carriageway")
      const roadImpact: NonNullable<LiveIncident["roadImpact"]> = {
        road: road || undefined,
        scope: /sliproad/i.test(carriageway) ? "ramp" : managementType === "roadClosed" ? "road" : managementType === "carriagewayClosures" ? "carriageway" : managementType === "laneClosures" ? "lane" : "unknown",
        restriction: ["roadClosed", "carriagewayClosures", "laneClosures"].includes(managementType ?? "") ? "closed" : managementType ? "restricted" : "unknown",
        direction: firstText(record, "alertCDirectionCoded") || undefined,
      }
      const location =
        [
          road,
          firstText(record, "locationDescription") ||
            firstText(record, "carriageway"),
        ]
          .filter(Boolean)
          .map(human)
          .join(" · ") || "Netherlands road network"
      const comments = [
        "generalPublicComment",
        "reroutingItineraryDescription",
        "roadworksDescription",
      ]
        .flatMap((name) =>
          descendants(record, name).flatMap((comment) =>
            descendants(comment, "value").map(plain)
          )
        )
        .filter(Boolean)
      const cause = human(firstText(record, "causeType")),
        compliance = firstText(record, "complianceOption")
      records.push({
        id: `ndw:${providerId}`,
        sourceId: "ndw",
        providerId,
        title: `${human(managementType && managementType !== "other" ? managementType : type || "Road situation")}${road ? ` · ${road}` : ""}`,
        description: [
          type,
          ...comments,
          cause ? `Cause: ${cause}.` : "",
          compliance ? `Compliance: ${human(compliance)}.` : "",
          probability ? `Provider probability: ${human(probability)}.` : "",
          "Road management or traffic report; does not necessarily mean a full road closure.",
        ]
          .filter(Boolean)
          .join(" ")
          .slice(0, 4000),
        kind: "road",
        severity,
        status,
        country: "Netherlands",
        location,
        coordinates: coordinates ?? coordinate(line[1], line[0]),
        geometry: ndwGeometry(record),
        roadImpact,
        startedAt,
        endedAt,
        updatedAt: date(record.situationRecordVersionTime),
        fetchedAt,
        url: PROVIDER_URLS.ndw,
        evidence: "reported-restriction",
        attribution: `NDW${source ? ` · ${source}` : ""}`,
      })
    }
  }
  const stale =
    !publicationTime ||
    Date.parse(fetchedAt) - Date.parse(publicationTime) > 10 * 60_000
  return {
    incidents: validRecords(records, rawCount),
    stale,
    message: `Netherlands current road situations, including restrictions, obstructions and traffic management. Publication: ${publicationTime || "not reported"}.${stale ? " Provider publication is over 10 minutes old or invalid." : ""}`,
  }
}

export function parsePortWatch(
  input: unknown,
  fetchedAt: string
): ProviderBatch {
  const rows = requiredArray(input, "features")
  const incidents = rows.flatMap((row) => {
    const p = object(object(row).attributes),
      eventId = text(p.eventid),
      eventType = text(p.eventtype)
    if (!eventId) return []
    const providerId = `${eventType}:${eventId}`
    return [
      {
        id: `portwatch:${providerId}`,
        sourceId: "portwatch" as const,
        providerId,
        title:
          plain(p.htmlname || p.eventname) ||
          `Historical disruption ${eventId}`,
        description: [
          plain(p.htmldescription),
          plain(p.severitytext),
          p.n_affectedports == null
            ? ""
            : `${text(p.n_affectedports)} affected port(s) recorded.`,
          "Historical reference only; not a current port-closure alert.",
        ]
          .filter(Boolean)
          .join(" "),
        kind: kind(eventType),
        severity: alertSeverity(p.alertlevel),
        status: "historical" as const,
        country: text(p.country) || "Not reported",
        location: text(p.country) || "Location not reported",
        coordinates: coordinate(p.long, p.lat),
        startedAt: date(p.fromdate),
        endedAt: date(p.todate),
        updatedAt: date(p.editdate),
        fetchedAt,
        url: PROVIDER_URLS.portwatch,
        evidence: "historical" as const,
        attribution: "IMF PortWatch · historical disruptions database",
      },
    ]
  })
  return {
    incidents: validRecords(incidents, rows.length),
    message: `Historical disruptions archive. These records are never shown as live incidents.${object(input).exceededTransferLimit ? " Result limit reached; archive coverage is partial." : ""}`,
  }
}
