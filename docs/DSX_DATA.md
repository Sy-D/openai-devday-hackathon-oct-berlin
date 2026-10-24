# DSX POD demo data and route assessment

The landing model is a schematic of ten component groups: two compute racks, network fabric, storage, power distribution, a coolant distribution unit, cooling manifolds, optical interconnects, controls, and the container including its roof. These categories reflect NVIDIA's [DSX POD technical overview](https://developer.nvidia.com/blog/achieve-productive-ai-capacity-faster-and-more-predictably-with-nvidia-dsx-pod/). The model is not NVIDIA CAD, an exact bill of materials, or a validated engineering layout.

Every supplier name, assignment, shipment, incident, cost and deadline in this demo is fictional. No event reports an actual disruption at NVIDIA or its partners. The data is separate from the supplier dashboard's anonymized dataset and the earlier manufacturing planner's gripper-kit scenario.

## Data and timing

`src/data/dsx.ts` contains 10 component groups, 18 logistics nodes, 38 directed transport edges, 30 qualified shipment alternatives and 10 disruption scenarios. All routes terminate at the illustrative Berlin integration site. Supplier readiness, transport durations and deadlines are measured in hours from the fixed scenario dispatch clock, 24 October 2026 at 10:00 UTC. A route's cost is whole-shipment transport cost in EUR; it excludes purchase price and site commissioning.

The initial scenario has three affected shipments:

| Component | Incident | Consequence | Qualified recovery |
| --- | --- | --- | --- |
| Compute rack A | Frankfurt inbound cargo lane closed | Booked route unavailable | Amsterdam air bridge |
| Coolant distribution unit | Flood restriction on Rotterdam–Hannover road | +24 hours, original route misses its 50-hour window | Coastal shipment at the deadline, or faster direct rail at higher cost |
| Container and roof | Brenner rail suspension | Booked rail route unavailable | Specialist road haulage or a western detour |

Controls and sensors are explicitly recorded as delivered in the seed. Confirming another route never marks a component as delivered. Later transport alerts do not reopen the controls shipment.

Subsequent scenarios cover port closure, oversized-load road restrictions, a supplier quality hold, missing supplier allocation, rail congestion, optical airfreight interruption, and a local delivery diversion. Each incident identifies the exact affected edges. The supplier allocation incident affects every qualified dispatch lane for the fabric supplier: transport rerouting cannot invent missing stock.

## Assessment rules

`getPartRoutes` evaluates the three declared alternatives for the selected component. An active blocked incident makes every intersecting route unavailable. Delays from distinct incidents add together, with each incident counted once per route even if it affects several edges. Duplicate event IDs do not add duplicate delay. Unknown event IDs are ignored for catalogue-version tolerance; unknown component IDs and cross-component route selection throw errors.

ETA equals supplier readiness plus transport duration plus applicable delays. The deadline buffer is the component's required delivery window minus ETA. A blocked route retains its numerical baseline estimate for comparison, but that estimate is not a deliverable schedule while the route is unavailable.

`recommendedRoute` selects the cheapest available alternative that meets the deadline, using ETA and then stable route ID to break ties. It returns no recommendation when every qualified route is blocked or late. It does not search all combinations in the graph, invent another supplier, reserve capacity, make a booking, or validate customs, load permits and actual provider schedules.

`getPartStatus` evaluates the selected route against current incidents. It returns blocked, delayed, on-track or the explicit delivered seed state. A newly delayed route remains visibly delayed even if its deadline buffer is still positive. A new event can therefore reopen review of a previously confirmed route.

## Verification

The dedicated route tests check graph connectivity, catalogue references, baseline component states, blocked-edge exclusion, real alternative paths, additive and deduplicated delays, unchanged unrelated routes, missing stock across all alternatives, no on-time recommendation, deterministic selection, invalid identifiers and new incidents against a previously selected route.
