/**
 * Illustrative DSX POD bill of materials and logistics scenario.
 * Every supplier, shipment, interruption, cost and deadline below is fictional.
 * Component categories follow NVIDIA's public DSX POD overview; this is not an
 * engineering drawing, actual partner allocation or a live incident feed.
 */
export type DsxPart = {
  id: string
  name: string
  category: string
  supplier: string
  supplierLocation: string
  description: string
  quantity: number
  unit: string
  deadlineHours: number
  defaultRouteId: string
  position: [number, number, number]
  deliveredAt?: string
}

export type TransportMode = "air" | "rail" | "road" | "sea"
export type TransportNode = {
  id: string
  name: string
  coordinates: [number, number]
}
export type TransportEdge = {
  id: string
  from: string
  to: string
  mode: TransportMode
  hours: number
  cost: number
}
export type ShipmentRoute = {
  id: string
  componentId: string
  name: string
  readyHours: number
  edgeIds: string[]
}
export type DisruptionEvent = {
  id: string
  title: string
  kind: "airspace" | "weather" | "rail" | "port" | "road" | "supplier"
  severity: "critical" | "warning"
  location: string
  description: string
  affectedEdgeIds: string[]
  delayHours: number
  blocked: boolean
  publishedAt: string
  source: "Simulated scenario"
  suggestedAction: string
}

export const DSX_SCENARIO_CLOCK = "2026-10-24T10:00:00Z"
export const dsxParts: DsxPart[] = [
  {
    id: "compute-a",
    name: "Compute rack A",
    category: "Compute",
    supplier: "Meridian Compute",
    supplierLocation: "Taoyuan, Taiwan",
    description:
      "Rack-scale compute trays and their factory-integrated chassis. Illustrative hardware, not an exact Vera Rubin configuration.",
    quantity: 8,
    unit: "compute trays",
    deadlineHours: 72,
    defaultRouteId: "compute-a-fra",
    position: [-1.5, 1.4, 0.35],
  },
  {
    id: "compute-b",
    name: "Compute rack B",
    category: "Compute",
    supplier: "Bohemia Systems",
    supplierLocation: "Prague, Czechia",
    description:
      "A second compute rack awaiting transport to the Berlin integration site.",
    quantity: 8,
    unit: "compute trays",
    deadlineHours: 56,
    defaultRouteId: "compute-b-road",
    position: [-0.55, 1.4, 0.35],
  },
  {
    id: "fabric",
    name: "Network fabric",
    category: "Networking",
    supplier: "Helix Networks",
    supplierLocation: "Dublin, Ireland",
    description:
      "Scale-out switches and management network equipment. Network testing follows physical installation.",
    quantity: 4,
    unit: "switches",
    deadlineHours: 60,
    defaultRouteId: "fabric-air",
    position: [0.45, 2.1, 0.3],
  },
  {
    id: "storage",
    name: "Storage array",
    category: "Storage",
    supplier: "Baltic Dataworks",
    supplierLocation: "Gdańsk, Poland",
    description:
      "Storage shelves for model data and checkpoints, with a separate shipment from compute.",
    quantity: 4,
    unit: "storage shelves",
    deadlineHours: 52,
    defaultRouteId: "storage-road",
    position: [0.45, 0.65, 0.3],
  },
  {
    id: "power",
    name: "Power distribution",
    category: "Power",
    supplier: "Alpine Power Systems",
    supplierLocation: "Vienna, Austria",
    description:
      "Rack power distribution and protection equipment. Power-on commissioning is a later quality gate.",
    quantity: 2,
    unit: "distribution units",
    deadlineHours: 60,
    defaultRouteId: "power-road",
    position: [1.4, 1.45, 0.25],
  },
  {
    id: "cooling",
    name: "Coolant distribution unit",
    category: "Cooling",
    supplier: "Delta Thermal Works",
    supplierLocation: "Rotterdam, Netherlands",
    description:
      "CDU and pump assembly feeding the internal liquid-cooling loop. Its delivery gates cooling commissioning.",
    quantity: 1,
    unit: "CDU",
    deadlineHours: 50,
    defaultRouteId: "cooling-road",
    position: [2.1, 0.8, -0.1],
  },
  {
    id: "manifold",
    name: "Cooling manifold",
    category: "Cooling",
    supplier: "Rhein Fluidics",
    supplierLocation: "Cologne, Germany",
    description:
      "Internal supply and return pipework, isolation valves and leak-detection fittings.",
    quantity: 2,
    unit: "manifolds",
    deadlineHours: 58,
    defaultRouteId: "manifold-road",
    position: [-0.4, 2.75, -0.2],
  },
  {
    id: "optics",
    name: "Optical interconnects",
    category: "Networking",
    supplier: "Photon Ridge",
    supplierLocation: "Zürich, Switzerland",
    description:
      "Optical transceivers and fiber harnesses connecting the compute and network racks.",
    quantity: 64,
    unit: "links",
    deadlineHours: 48,
    defaultRouteId: "optics-air",
    position: [-0.6, 2.5, 0.85],
  },
  {
    id: "controls",
    name: "Controls and sensors",
    category: "Controls",
    supplier: "Elbe Controls",
    supplierLocation: "Dresden, Germany",
    description:
      "Environmental sensors, leak detection and monitoring gateway. This shipment is already delivered in the seed scenario.",
    quantity: 1,
    unit: "control kit",
    deadlineHours: 48,
    defaultRouteId: "controls-road",
    position: [1.45, 2.35, 0.35],
    deliveredAt: "2026-10-24T08:30:00Z",
  },
  {
    id: "enclosure",
    name: "Container and roof",
    category: "Structure",
    supplier: "Torino Modular",
    supplierLocation: "Turin, Italy",
    description:
      "Transport enclosure, removable roof panels, restraints and service-access structure. The model is schematic and not to scale.",
    quantity: 1,
    unit: "enclosure",
    deadlineHours: 96,
    defaultRouteId: "enclosure-rail",
    position: [0, 3.15, 0],
  },
]

export const transportNodes: TransportNode[] = [
  { id: "taoyuan", name: "Taoyuan air cargo", coordinates: [121.23, 25.08] },
  { id: "frankfurt", name: "Frankfurt cargo hub", coordinates: [8.57, 50.04] },
  { id: "amsterdam", name: "Amsterdam cargo hub", coordinates: [4.76, 52.31] },
  { id: "hamburg", name: "Hamburg port", coordinates: [9.97, 53.54] },
  { id: "prague", name: "Prague dispatch", coordinates: [14.44, 50.08] },
  { id: "dublin", name: "Dublin dispatch", coordinates: [-6.26, 53.35] },
  {
    id: "calais",
    name: "Channel freight terminal",
    coordinates: [1.86, 50.95],
  },
  { id: "gdansk", name: "Gdańsk dispatch", coordinates: [18.65, 54.35] },
  { id: "vienna", name: "Vienna dispatch", coordinates: [16.37, 48.21] },
  { id: "rotterdam", name: "Rotterdam dispatch", coordinates: [4.48, 51.92] },
  { id: "hannover", name: "Hannover cross-dock", coordinates: [9.73, 52.37] },
  { id: "cologne", name: "Cologne dispatch", coordinates: [6.96, 50.94] },
  { id: "zurich", name: "Zürich dispatch", coordinates: [8.54, 47.38] },
  { id: "dresden", name: "Dresden dispatch", coordinates: [13.74, 51.05] },
  { id: "turin", name: "Turin dispatch", coordinates: [7.69, 45.07] },
  { id: "munich", name: "Munich freight hub", coordinates: [11.58, 48.14] },
  { id: "lyon", name: "Lyon freight hub", coordinates: [4.84, 45.76] },
  {
    id: "berlin",
    name: "Berlin integration site",
    coordinates: [13.41, 52.52],
  },
]

// Costs are illustrative whole-shipment transport costs in EUR. Each route's
// readyHours includes supplier preparation, handling and departure scheduling.
export const transportEdges: TransportEdge[] = [
  {
    id: "tpe-fra-air",
    from: "taoyuan",
    to: "frankfurt",
    mode: "air",
    hours: 18,
    cost: 9600,
  },
  {
    id: "tpe-ams-air",
    from: "taoyuan",
    to: "amsterdam",
    mode: "air",
    hours: 20,
    cost: 13400,
  },
  {
    id: "tpe-ham-sea",
    from: "taoyuan",
    to: "hamburg",
    mode: "sea",
    hours: 600,
    cost: 3800,
  },
  {
    id: "fra-ber-road",
    from: "frankfurt",
    to: "berlin",
    mode: "road",
    hours: 10,
    cost: 1900,
  },
  {
    id: "ams-ber-road",
    from: "amsterdam",
    to: "berlin",
    mode: "road",
    hours: 13,
    cost: 2200,
  },
  {
    id: "ham-ber-road",
    from: "hamburg",
    to: "berlin",
    mode: "road",
    hours: 6,
    cost: 900,
  },
  {
    id: "prg-ber-road",
    from: "prague",
    to: "berlin",
    mode: "road",
    hours: 7,
    cost: 1600,
  },
  {
    id: "prg-drs-rail",
    from: "prague",
    to: "dresden",
    mode: "rail",
    hours: 9,
    cost: 700,
  },
  {
    id: "drs-ber-road",
    from: "dresden",
    to: "berlin",
    mode: "road",
    hours: 4,
    cost: 550,
  },
  {
    id: "prg-ber-air",
    from: "prague",
    to: "berlin",
    mode: "air",
    hours: 6,
    cost: 4700,
  },
  {
    id: "dub-ber-air",
    from: "dublin",
    to: "berlin",
    mode: "air",
    hours: 9,
    cost: 2600,
  },
  {
    id: "dub-ams-air",
    from: "dublin",
    to: "amsterdam",
    mode: "air",
    hours: 8,
    cost: 1800,
  },
  {
    id: "dub-cal-sea",
    from: "dublin",
    to: "calais",
    mode: "sea",
    hours: 25,
    cost: 700,
  },
  {
    id: "cal-ber-rail",
    from: "calais",
    to: "berlin",
    mode: "rail",
    hours: 19,
    cost: 1100,
  },
  {
    id: "gdn-ber-road",
    from: "gdansk",
    to: "berlin",
    mode: "road",
    hours: 9,
    cost: 1100,
  },
  {
    id: "gdn-ber-rail",
    from: "gdansk",
    to: "berlin",
    mode: "rail",
    hours: 17,
    cost: 700,
  },
  {
    id: "gdn-ber-air",
    from: "gdansk",
    to: "berlin",
    mode: "air",
    hours: 7,
    cost: 3200,
  },
  {
    id: "vie-ber-road",
    from: "vienna",
    to: "berlin",
    mode: "road",
    hours: 14,
    cost: 1500,
  },
  {
    id: "vie-prg-rail",
    from: "vienna",
    to: "prague",
    mode: "rail",
    hours: 10,
    cost: 600,
  },
  {
    id: "vie-ber-air",
    from: "vienna",
    to: "berlin",
    mode: "air",
    hours: 8,
    cost: 4200,
  },
  {
    id: "rtm-han-road",
    from: "rotterdam",
    to: "hannover",
    mode: "road",
    hours: 10,
    cost: 1700,
  },
  {
    id: "han-ber-road",
    from: "hannover",
    to: "berlin",
    mode: "road",
    hours: 6,
    cost: 1000,
  },
  {
    id: "rtm-ham-sea",
    from: "rotterdam",
    to: "hamburg",
    mode: "sea",
    hours: 24,
    cost: 2100,
  },
  {
    id: "rtm-ber-rail",
    from: "rotterdam",
    to: "berlin",
    mode: "rail",
    hours: 18,
    cost: 3900,
  },
  {
    id: "cgn-ber-road",
    from: "cologne",
    to: "berlin",
    mode: "road",
    hours: 11,
    cost: 850,
  },
  {
    id: "cgn-han-rail",
    from: "cologne",
    to: "hannover",
    mode: "rail",
    hours: 10,
    cost: 500,
  },
  {
    id: "cgn-ber-air",
    from: "cologne",
    to: "berlin",
    mode: "air",
    hours: 6,
    cost: 2400,
  },
  {
    id: "zrh-ber-air",
    from: "zurich",
    to: "berlin",
    mode: "air",
    hours: 7,
    cost: 1800,
  },
  {
    id: "zrh-muc-road",
    from: "zurich",
    to: "munich",
    mode: "road",
    hours: 7,
    cost: 650,
  },
  {
    id: "muc-ber-road",
    from: "munich",
    to: "berlin",
    mode: "road",
    hours: 10,
    cost: 1400,
  },
  {
    id: "zrh-ber-rail",
    from: "zurich",
    to: "berlin",
    mode: "rail",
    hours: 19,
    cost: 1200,
  },
  {
    id: "drs-ber-rail",
    from: "dresden",
    to: "berlin",
    mode: "rail",
    hours: 7,
    cost: 300,
  },
  {
    id: "drs-prg-road",
    from: "dresden",
    to: "prague",
    mode: "road",
    hours: 4,
    cost: 400,
  },
  {
    id: "trn-muc-rail",
    from: "turin",
    to: "munich",
    mode: "rail",
    hours: 22,
    cost: 4800,
  },
  {
    id: "muc-ber-rail",
    from: "munich",
    to: "berlin",
    mode: "rail",
    hours: 16,
    cost: 3100,
  },
  {
    id: "trn-lyo-road",
    from: "turin",
    to: "lyon",
    mode: "road",
    hours: 12,
    cost: 4400,
  },
  {
    id: "lyo-ber-road",
    from: "lyon",
    to: "berlin",
    mode: "road",
    hours: 27,
    cost: 7200,
  },
  {
    id: "trn-muc-road",
    from: "turin",
    to: "munich",
    mode: "road",
    hours: 20,
    cost: 6100,
  },
]

export const shipmentRoutes: ShipmentRoute[] = [
  {
    id: "compute-a-fra",
    componentId: "compute-a",
    name: "Frankfurt air bridge",
    readyHours: 24,
    edgeIds: ["tpe-fra-air", "fra-ber-road"],
  },
  {
    id: "compute-a-ams",
    componentId: "compute-a",
    name: "Amsterdam air bridge",
    readyHours: 24,
    edgeIds: ["tpe-ams-air", "ams-ber-road"],
  },
  {
    id: "compute-a-sea",
    componentId: "compute-a",
    name: "Hamburg ocean freight",
    readyHours: 24,
    edgeIds: ["tpe-ham-sea", "ham-ber-road"],
  },
  {
    id: "compute-b-road",
    componentId: "compute-b",
    name: "Direct dedicated truck",
    readyHours: 30,
    edgeIds: ["prg-ber-road"],
  },
  {
    id: "compute-b-rail",
    componentId: "compute-b",
    name: "Dresden rail transfer",
    readyHours: 30,
    edgeIds: ["prg-drs-rail", "drs-ber-road"],
  },
  {
    id: "compute-b-air",
    componentId: "compute-b",
    name: "Priority air cargo",
    readyHours: 24,
    edgeIds: ["prg-ber-air"],
  },
  {
    id: "fabric-air",
    componentId: "fabric",
    name: "Direct air freight",
    readyHours: 24,
    edgeIds: ["dub-ber-air"],
  },
  {
    id: "fabric-ams",
    componentId: "fabric",
    name: "Amsterdam transfer",
    readyHours: 24,
    edgeIds: ["dub-ams-air", "ams-ber-road"],
  },
  {
    id: "fabric-sea",
    componentId: "fabric",
    name: "Channel sea and rail",
    readyHours: 24,
    edgeIds: ["dub-cal-sea", "cal-ber-rail"],
  },
  {
    id: "storage-road",
    componentId: "storage",
    name: "Direct storage shipment",
    readyHours: 24,
    edgeIds: ["gdn-ber-road"],
  },
  {
    id: "storage-rail",
    componentId: "storage",
    name: "Consolidated rail",
    readyHours: 24,
    edgeIds: ["gdn-ber-rail"],
  },
  {
    id: "storage-air",
    componentId: "storage",
    name: "Priority storage airlift",
    readyHours: 18,
    edgeIds: ["gdn-ber-air"],
  },
  {
    id: "power-road",
    componentId: "power",
    name: "Direct power shipment",
    readyHours: 30,
    edgeIds: ["vie-ber-road"],
  },
  {
    id: "power-rail",
    componentId: "power",
    name: "Prague rail transfer",
    readyHours: 30,
    edgeIds: ["vie-prg-rail", "prg-drs-rail", "drs-ber-road"],
  },
  {
    id: "power-air",
    componentId: "power",
    name: "Priority power airlift",
    readyHours: 24,
    edgeIds: ["vie-ber-air"],
  },
  {
    id: "cooling-road",
    componentId: "cooling",
    name: "Hannover road corridor",
    readyHours: 20,
    edgeIds: ["rtm-han-road", "han-ber-road"],
  },
  {
    id: "cooling-sea",
    componentId: "cooling",
    name: "Hamburg coastal route",
    readyHours: 20,
    edgeIds: ["rtm-ham-sea", "ham-ber-road"],
  },
  {
    id: "cooling-rail",
    componentId: "cooling",
    name: "Direct heavy-freight rail",
    readyHours: 20,
    edgeIds: ["rtm-ber-rail"],
  },
  {
    id: "manifold-road",
    componentId: "manifold",
    name: "Direct manifold delivery",
    readyHours: 24,
    edgeIds: ["cgn-ber-road"],
  },
  {
    id: "manifold-rail",
    componentId: "manifold",
    name: "Hannover rail transfer",
    readyHours: 24,
    edgeIds: ["cgn-han-rail", "han-ber-road"],
  },
  {
    id: "manifold-air",
    componentId: "manifold",
    name: "Priority manifold delivery",
    readyHours: 18,
    edgeIds: ["cgn-ber-air"],
  },
  {
    id: "optics-air",
    componentId: "optics",
    name: "Direct optical airfreight",
    readyHours: 20,
    edgeIds: ["zrh-ber-air"],
  },
  {
    id: "optics-road",
    componentId: "optics",
    name: "Munich road transfer",
    readyHours: 20,
    edgeIds: ["zrh-muc-road", "muc-ber-road"],
  },
  {
    id: "optics-rail",
    componentId: "optics",
    name: "Direct optical rail freight",
    readyHours: 20,
    edgeIds: ["zrh-ber-rail"],
  },
  {
    id: "controls-road",
    componentId: "controls",
    name: "Dresden controls delivery",
    readyHours: 8,
    edgeIds: ["drs-ber-road"],
  },
  {
    id: "controls-rail",
    componentId: "controls",
    name: "Controls rail delivery",
    readyHours: 8,
    edgeIds: ["drs-ber-rail"],
  },
  {
    id: "controls-prague",
    componentId: "controls",
    name: "Prague consolidation",
    readyHours: 8,
    edgeIds: ["drs-prg-road", "prg-ber-road"],
  },
  {
    id: "enclosure-rail",
    componentId: "enclosure",
    name: "Brenner rail corridor",
    readyHours: 36,
    edgeIds: ["trn-muc-rail", "muc-ber-rail"],
  },
  {
    id: "enclosure-lyon",
    componentId: "enclosure",
    name: "Western overland detour",
    readyHours: 36,
    edgeIds: ["trn-lyo-road", "lyo-ber-road"],
  },
  {
    id: "enclosure-road",
    componentId: "enclosure",
    name: "Alpine specialist haulage",
    readyHours: 36,
    edgeIds: ["trn-muc-road", "muc-ber-road"],
  },
]

export const disruptionEvents: DisruptionEvent[] = [
  {
    id: "airspace-central",
    title: "Frankfurt cargo lane closed",
    kind: "airspace",
    severity: "critical",
    location: "Taoyuan → Frankfurt",
    description:
      "Simulated airspace restriction cancels the booked Frankfurt inbound cargo service. Compute rack A cannot use this lane.",
    affectedEdgeIds: ["tpe-fra-air"],
    delayHours: 0,
    blocked: true,
    publishedAt: "2026-10-24T09:42:00Z",
    source: "Simulated scenario",
    suggestedAction:
      "Compare the Amsterdam air bridge; it bypasses the closed flight lane.",
  },
  {
    id: "rhine-flood",
    title: "Flooding slows the cooling shipment",
    kind: "weather",
    severity: "critical",
    location: "Rotterdam → Hannover",
    description:
      "Simulated flood restrictions add 24 hours to the booked CDU road corridor. The original cooling delivery now misses its deadline.",
    affectedEdgeIds: ["rtm-han-road"],
    delayHours: 24,
    blocked: false,
    publishedAt: "2026-10-24T09:48:00Z",
    source: "Simulated scenario",
    suggestedAction:
      "Move the CDU to direct heavy-freight rail to avoid the affected road.",
  },
  {
    id: "brenner-rail",
    title: "Brenner freight line suspended",
    kind: "rail",
    severity: "critical",
    location: "Turin → Munich",
    description:
      "Simulated track damage suspends the booked enclosure rail corridor. The roof and enclosure are held at origin.",
    affectedEdgeIds: ["trn-muc-rail"],
    delayHours: 0,
    blocked: true,
    publishedAt: "2026-10-24T09:55:00Z",
    source: "Simulated scenario",
    suggestedAction:
      "Compare permitted specialist-road alternatives and their delivery buffers.",
  },
  {
    id: "north-sea-storm",
    title: "North Sea port departure suspended",
    kind: "port",
    severity: "critical",
    location: "Rotterdam → Hamburg",
    description:
      "Simulated high winds stop coastal cargo departures. The CDU coastal alternative is temporarily unavailable.",
    affectedEdgeIds: ["rtm-ham-sea"],
    delayHours: 0,
    blocked: true,
    publishedAt: "2026-10-24T10:05:00Z",
    source: "Simulated scenario",
    suggestedAction:
      "Use the inland rail route while the port restriction is active.",
  },
  {
    id: "alpine-road",
    title: "Alpine heavy-haul permit window lost",
    kind: "road",
    severity: "warning",
    location: "Turin → Munich road corridor",
    description:
      "Simulated road works push oversized-load escort availability back by 36 hours. The enclosure road alternative becomes late.",
    affectedEdgeIds: ["trn-muc-road"],
    delayHours: 36,
    blocked: false,
    publishedAt: "2026-10-24T10:10:00Z",
    source: "Simulated scenario",
    suggestedAction: "Review the western overland detour through Lyon.",
  },
  {
    id: "power-quality",
    title: "Power equipment held for retest",
    kind: "supplier",
    severity: "warning",
    location: "Vienna dispatch",
    description:
      "A fictional supplier quality hold delays release of power distribution equipment by 30 hours, regardless of transport mode.",
    affectedEdgeIds: ["vie-ber-road", "vie-prg-rail", "vie-ber-air"],
    delayHours: 30,
    blocked: false,
    publishedAt: "2026-10-24T10:15:00Z",
    source: "Simulated scenario",
    suggestedAction:
      "Compare the priority departure after retest; an unqualified supplier substitution is not offered.",
  },
  {
    id: "fabric-shortage",
    title: "Network fabric allocation on hold",
    kind: "supplier",
    severity: "critical",
    location: "Dublin dispatch",
    description:
      "A fictional component allocation hold stops all qualified shipments from the fabric supplier. Changing the transport lane cannot fix the missing stock.",
    affectedEdgeIds: ["dub-ber-air", "dub-ams-air", "dub-cal-sea"],
    delayHours: 0,
    blocked: true,
    publishedAt: "2026-10-24T10:20:00Z",
    source: "Simulated scenario",
    suggestedAction:
      "Escalate the supplier allocation or qualify replacement stock; no feasible route is currently available.",
  },
  {
    id: "channel-rail",
    title: "Channel freight terminal congestion",
    kind: "rail",
    severity: "warning",
    location: "Channel freight terminal → Berlin",
    description:
      "Simulated terminal congestion adds 20 hours to the sea-and-rail network fabric alternative.",
    affectedEdgeIds: ["cal-ber-rail"],
    delayHours: 20,
    blocked: false,
    publishedAt: "2026-10-24T10:25:00Z",
    source: "Simulated scenario",
    suggestedAction:
      "Review available air options only after the supplier allocation is released.",
  },
  {
    id: "optics-air",
    title: "Zürich cargo handling interruption",
    kind: "airspace",
    severity: "critical",
    location: "Zürich → Berlin",
    description:
      "Simulated cargo handling closure cancels the optical interconnect air shipment. Road and rail alternatives remain available.",
    affectedEdgeIds: ["zrh-ber-air"],
    delayHours: 0,
    blocked: true,
    publishedAt: "2026-10-24T10:30:00Z",
    source: "Simulated scenario",
    suggestedAction:
      "Compare optical rail freight and the Munich road transfer.",
  },
  {
    id: "berlin-road",
    title: "Berlin integration-site road diversion",
    kind: "road",
    severity: "warning",
    location: "Road approaches to Berlin",
    description:
      "A simulated local delivery diversion adds 8 hours to inbound road shipments. Rail and direct air arrivals use separate receiving arrangements.",
    affectedEdgeIds: [
      "fra-ber-road",
      "ams-ber-road",
      "ham-ber-road",
      "prg-ber-road",
      "drs-ber-road",
      "gdn-ber-road",
      "vie-ber-road",
      "han-ber-road",
      "cgn-ber-road",
      "muc-ber-road",
      "lyo-ber-road",
    ],
    delayHours: 8,
    blocked: false,
    publishedAt: "2026-10-24T10:35:00Z",
    source: "Simulated scenario",
    suggestedAction:
      "Recheck confirmed road ETA estimates and compare rail access where qualified.",
  },
]

export const initialDisruptionIds = [
  "airspace-central",
  "rhine-flood",
  "brenner-rail",
]
