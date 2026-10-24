# Live incident sources

The incident workspace reads public provider reports. It does not infer a supplier delay, a closed route, or a shipment impact from a nearby hazard. Product references and illustrative recovery scenarios are separate from this evidence.

## Connected coverage

| Source | Coverage and interpretation | Refresh while the workspace is open | Limits |
| --- | --- | --- | --- |
| [GDACS](https://www.gdacs.org/gdacsapi/swagger/index.html) | Worldwide natural-hazard reports. Current episode alert is shown alongside the event's peak alert in the description. | 6 minutes | Recent 7-day query, first 100 events. A hazard is not a confirmed transport closure. A past event end date is not proof that recovery is complete. |
| [NASA EONET v3](https://eonet.gsfc.nasa.gov/docs/v3) | Worldwide curated natural-event observations with provider links, geometry observations and explicit open/closed state. | 10 minutes | Last 30 days, up to 100 records. The source card reports when the result cap is reached. Country and operational severity are not supplied, so remain unknown. EONET may cite GDACS: these are source reports, not a deduplicated global incident count. |
| [Autobahn traffic API](https://verkehr.autobahn.de/o/autobahn/) | Germany's **A2 only**, using closure and warning services. Ramp closures are labelled as ramp restrictions. | 60 seconds | Not nationwide road coverage. String booleans are parsed explicitly. Provider descriptions preserve dates and delays; an absent machine-readable end/update date is left absent. Some warnings attribute INRIX. |
| [NDW current situations](https://docs.ndw.nu/producten/situatieberichten-v3/) | Netherlands DATEX II current road situations: lane/carriageway restrictions, obstructions, accidents, traffic management and rerouting notices. | 60 seconds | Traffic management is not necessarily a blockage. Point locations, or the first coordinate of a reported line, are map markers, not full closure polygons. Publication age over 10 minutes is shown as stale. |
| [IMF PortWatch disruptions layer](https://services9.arcgis.com/weJ1QsnbMYJlCHdG/ArcGIS/rest/services/portwatch_disruptions_database/FeatureServer/0) | Historical disruption reference records, with recorded port impact counts. | 6 hours | Always `historical`, never a live port closure. Latest event observed in the feasibility check was 14 August 2026. First 200 records ordered newest first; a provider truncation flag is surfaced. |

All five are connected without an API key or a purchased account. Access does not establish unrestricted redistribution rights. Preserve attribution and provider links; review provider terms before broader commercial redistribution. [GDACS terms](https://www.gdacs.org/Documents/2025/GDACS_Terms_of_use_Mar_25.pdf) require acknowledgement. [NDW terms](https://docs.ndw.nu/algemeen/data-gebruiksvoorwaarden/) describe the default CC0 policy and exceptions. NASA publishes an [EONET disclaimer](https://eonet.gsfc.nasa.gov/what-is-eonet). No blanket reuse licence for the Autobahn/INRIX material or PortWatch layer is asserted here.

Flight restrictions, rail freight interruptions, worldwide road closures and current global port closures are **not connected**. GDELT returned a rate limit during feasibility testing and would be news evidence, not closure confirmation. EUROCONTROL, TomTom and DB RIS require credentials, agreements or further feasibility work; their absence is not filled with simulated records.

## Provider update workflow

1. `GET /api/incidents` returns an `IncidentSnapshot` with source health and normalized reports.
2. `GET /api/incidents/stream` pushes `event: snapshot` messages from one polling broker per server process. A new subscriber receives a complete snapshot; the shared broker checks the cache every 15 seconds. Provider TTLs prevent every viewer from triggering a new upstream poll.
3. Connections include keepalive comments, close after 55 seconds, and advertise a 3-second reconnect delay. EventSource reconnects and receives the latest snapshot. IDs and substantive revisions let the browser reconcile changes without treating every retrieval as a new alert.
4. Each successful provider response replaces that provider's snapshot. Added IDs appear, changed IDs update, and reports absent from a later successful response leave the current provider snapshot. Disappearance is **not** recorded as a confirmed resolution. Explicit provider closure/end states remain distinct.
5. A failed or malformed provider response retains its last successful records and marks the source `stale`. On initial failure, the source is `unavailable` with zero records. A valid empty provider response is accepted. There is no simulated fallback.

Only GET handlers are implemented. POST, PUT and DELETE receive HTTP 405; there is no clear/reset/delete endpoint. Source links are read-only references. Changing local filters only changes the displayed selection.

`startedAt`, `endedAt` and `updatedAt` come from provider data, when supplied. EONET `updatedAt` is the latest geometry observation time, not an unpublished editorial revision time. `fetchedAt` records the retrieval attempt associated with a successful snapshot. Source `checkedAt` and `lastSuccessAt` describe our connection, not when the underlying incident occurred. A source state of `live` means the current connector returned valid data; it does not make every report active or recent.

## Reliability and deployment

- Independent sources run concurrently with 12-second request/body deadlines. JSON bodies are capped at 4 MB; NDW compressed/decompressed input is capped at 12 MB. XML is validated, entity/DOCTYPE declarations are rejected, and gzip expansion is bounded.
- A source failure does not stop other sources. Both Autobahn endpoints must succeed before replacing the previous complete A2 snapshot. Shared in-flight requests and TTLs prevent request stampedes inside one process.
- The cache is in memory. It survives requests and development hot reloads, not a process restart. A cold process with an upstream outage cannot recover the previous process's snapshot. Multiple deployed instances each have their own cache; this version has no durable archive, external poll scheduler, webhook registration or cross-instance broker.
- Push delivery to the browser is SSE over server polling. It is not an upstream provider webhook and is not a background operating-system push notification. The stream stops polling when the last subscriber disconnects; GET requests also refresh expired cache entries.
- No provider report automatically changes a shipment, supplier status or recovery plan. Linking an incident to an actual purchase order requires verified supplier/facility and shipment-route data that this workspace does not yet have.

## Verification

`npx tsx --test server/live-incidents.test.ts` covers ramp/future semantics, episode severity, provider date normalization, namespace/geometry handling, malformed responses, historical PortWatch status, independent failures, shared requests, upstream removals, stale retention, revision deduplication, payload limits and SSE cancellation/lifetime.

Actual read-only source smoke on 24 October 2026 at 12:43 UTC returned 1,823 source records in 1.84 seconds: GDACS 6, EONET 100 (cap disclosed), Autobahn A2 22, NDW 1,563 and PortWatch 132 historical. NDW publication was 12:43 UTC. These are point-in-time verification counts; feeds change. `GET /api/incidents` returned HTTP 200 through the Next development server. Follow-on HTTP checks confirmed POST/PUT/DELETE each return 405, and the SSE route returned 200 with a complete current snapshot (1,820 records at that later check) and all source statuses. The server never substitutes those observed counts or stored fixtures for live responses.
