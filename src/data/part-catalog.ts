/**
 * Source-backed hardware references for the illustrative DSX workspace.
 * These are candidate products, not an approved BOM, purchases, or shipments.
 * A manufacturer's factory footprint never establishes a unit's origin.
 */
export const PART_RESEARCHED_AT = "2026-10-24"

export type PartComponentId =
  | "compute-a"
  | "compute-b"
  | "fabric"
  | "storage"
  | "power"
  | "cooling"
  | "manifold"
  | "optics"
  | "controls"
  | "enclosure"

export type PartSource = {
  title: string
  url: string
  scope: "product" | "manufacturing-footprint"
  publishedAt?: string
}

export type PartOrigin = {
  status: "unknown" | "product-verified" | "company-footprint"
  summary: string
  locations: string[]
  sourceUrls: string[]
}

export type PartReference = {
  componentId: PartComponentId
  productName: string
  manufacturer: string
  category: string
  summary: string
  verifiedSpecs: string[]
  referenceStatus: "reference-candidate"
  procurementStatus: "not-confirmed"
  fitNote: string
  origin: PartOrigin
  sources: PartSource[]
  researchedAt: string
}

const hpeQuickSpecs = {
  title: "HPE GB300 NVL72 QuickSpecs",
  url: "https://www.hpe.com/us/en/collaterals/collateral.a50009244enw.html",
  scope: "product",
} satisfies PartSource

const supermicroFootprint = {
  title: "Supermicro 2024 Sustainability Report",
  url: "https://www.supermicro.com/GreenComputing/Supermicro-ESG-Report-2024.pdf",
  scope: "manufacturing-footprint",
} satisfies PartSource

const hpeFootprint = {
  title: "HPE Czech manufacturing announcement (2022)",
  url: "https://www.hpe.com/us/en/newsroom/press-release/2022/05/hewlett-packard-enterprise-strengthens-europes-supercomputer-supply-chain-with-new-factory-in-czech-republic.html",
  scope: "manufacturing-footprint",
  publishedAt: "2022-05-18",
} satisfies PartSource

const nventFootprint = {
  title: "nVent manufacturing expansion (2025)",
  url: "https://investors.nvent.com/press-releases/press-release-details/2025/nVent-Expands-Data-Center-Solutions-Manufacturing-with-New-U-S--Production-Facility/default.aspx",
  scope: "manufacturing-footprint",
  publishedAt: "2025-09-03",
} satisfies PartSource

function unknownOrigin(summary?: string): PartOrigin {
  return {
    status: "unknown",
    summary:
      summary ??
      "The reviewed manufacturer documentation does not establish this product's manufacturing or dispatch location.",
    locations: [],
    sourceUrls: [],
  }
}

function reference(
  part: Omit<
    PartReference,
    "referenceStatus" | "procurementStatus" | "researchedAt"
  >
): PartReference {
  return {
    ...part,
    referenceStatus: "reference-candidate",
    procurementStatus: "not-confirmed",
    researchedAt: PART_RESEARCHED_AT,
  }
}

export const partCatalog = {
  "compute-a": reference({
    componentId: "compute-a",
    productName: "SuperServer SRS-GB300-NVL72",
    manufacturer: "Supermicro",
    category: "Compute",
    summary: "A liquid-cooled rack system built around NVIDIA GB300 NVL72.",
    verifiedSpecs: [
      "72 NVIDIA B300 GPUs and 36 Grace CPUs",
      "18 compute nodes in a 48U rack",
    ],
    fitNote:
      "Rack-level reference. The schematic tray count and geometry are not this system's engineering layout.",
    origin: {
      status: "company-footprint",
      summary:
        "Supermicro's 2024 report lists manufacturing in the US, Taiwan, Malaysia and the Netherlands. It does not identify the factory or dispatch point for an SRS-GB300-NVL72 order.",
      locations: ["United States", "Taiwan", "Malaysia", "Netherlands"],
      sourceUrls: [supermicroFootprint.url],
    },
    sources: [
      {
        title: "Supermicro SRS-GB300-NVL72 specifications",
        url: "https://www.supermicro.com/en/products/rack/srs-gb300-nvl72",
        scope: "product",
      },
      supermicroFootprint,
    ],
  }),
  "compute-b": reference({
    componentId: "compute-b",
    productName: "NVIDIA GB300 NVL72 by HPE",
    manufacturer: "HPE",
    category: "Compute",
    summary: "HPE's liquid-cooled implementation of the GB300 NVL72 platform.",
    verifiedSpecs: [
      "72 Blackwell Ultra GPUs with 36 Grace CPUs",
      "18 compute trays; fifth-generation NVLink",
    ],
    fitNote:
      "A second vendor reference, not evidence that mixed-vendor racks have been qualified together for this project.",
    origin: {
      status: "company-footprint",
      summary:
        "HPE's 2022 announcement documents existing server and storage manufacturing in Kutná Hora, Czechia. It does not assign GB300 production or this project's dispatch to that site.",
      locations: ["Kutná Hora, Czechia (company site documented in 2022)"],
      sourceUrls: [hpeFootprint.url],
    },
    sources: [hpeQuickSpecs, hpeFootprint],
  }),
  fabric: reference({
    componentId: "fabric",
    productName: "Spectrum-4 SN5600",
    manufacturer: "NVIDIA",
    category: "Networking",
    summary: "An Ethernet switch for connecting data-center racks and fabrics.",
    verifiedSpecs: [
      "64 OSFP ports supporting 800GbE",
      "2U switch; 51.2 Tb/s maximum throughput",
    ],
    fitNote:
      "Scale-out Ethernet reference. Port selection, optics and network topology still require validation.",
    origin: unknownOrigin(),
    sources: [
      {
        title: "NVIDIA SN5000 hardware manual",
        url: "https://networking-docs.nvidia.com/sn5000hw/introduction",
        scope: "product",
      },
    ],
  }),
  storage: reference({
    componentId: "storage",
    productName: "AFF A1K",
    manufacturer: "NetApp",
    category: "Storage",
    summary: "A storage-system reference for shared datasets and checkpoints.",
    verifiedSpecs: [
      "High-availability pair with two 2U controller chassis",
      "Supports NFS, SMB, S3 and NVMe/TCP storage protocols",
    ],
    fitNote:
      "Capacity, media shelves and workload performance are not sized for this project. The schematic's four shelves are not a validated configuration.",
    origin: unknownOrigin(),
    sources: [
      {
        title: "NetApp AFF A1K specifications",
        url: "https://docs.netapp.com/us-en/ontap-systems/a1k/overview.html",
        scope: "product",
      },
      {
        title: "NetApp AFF A1K installation requirements",
        url: "https://docs.netapp.com/us-en/ontap-systems/a1k/install-prepare.html",
        scope: "product",
      },
    ],
  }),
  power: reference({
    componentId: "power",
    productName: "33 kW Power-Capacitance Shelf Kit (S6E21A)",
    manufacturer: "HPE",
    category: "Power",
    summary: "A rack power-shelf option listed for HPE's GB300 NVL72 system.",
    verifiedSpecs: [
      "1U shelf rated at 33 kW and 50 V DC",
      "Air-cooled left power-capacitance shelf kit",
    ],
    fitNote:
      "A rack power component, not a complete facility power design. HPE lists eight power shelves in its system; the demo quantity is not a sizing recommendation.",
    origin: unknownOrigin(
      "HPE lists the kit and SKU, but the reviewed specification does not identify the shelf's original manufacturer or factory. HPE's server-site evidence cannot establish this shelf's origin."
    ),
    sources: [hpeQuickSpecs],
  }),
  cooling: reference({
    componentId: "cooling",
    productName: "CoolChip CDU 600",
    manufacturer: "Vertiv",
    category: "Cooling",
    summary:
      "A liquid-to-liquid CDU that transfers heat from a server cooling loop.",
    verifiedSpecs: [
      "600 kW nominal capacity at a 4°C approach temperature difference",
      "Redundant pumps with variable-speed control and integrated filtration",
    ],
    fitNote:
      "Cooling reference only. Facility water, fluid chemistry, flow, pressure and total heat load must be engineered together.",
    origin: unknownOrigin(),
    sources: [
      {
        title: "Vertiv CoolChip CDU 600 product specifications",
        url: "https://www.vertiv.com/en-us/products-catalog/thermal-management/high-density-solutions/vertiv-coolchip-cdu-600/",
        scope: "product",
      },
    ],
  }),
  manifold: reference({
    componentId: "manifold",
    productName: "RackChiller Rack Manifold (RCM42001)",
    manufacturer: "nVent HOFFMAN",
    category: "Cooling",
    summary:
      "Supply and return manifolds carrying coolant between a CDU and cold plates.",
    verifiedSpecs: [
      "Stainless-steel manifold pair for supply and return",
      "Standard configuration connects to cold plates through jumper hoses",
    ],
    fitNote:
      "Reference plumbing hardware. Connector types, materials and flow requirements must be checked against the selected racks and CDU.",
    origin: {
      status: "company-footprint",
      summary:
        "nVent's 2025 announcement describes expanded data-center manufacturing in Anoka, Minnesota. It does not identify an RCM42001 factory or shipment origin.",
      locations: ["Anoka, Minnesota, United States (company footprint)"],
      sourceUrls: [nventFootprint.url],
    },
    sources: [
      {
        title: "nVent RackChiller manifold specification (PDF)",
        url: "https://www.nvent.com/sites/default/files/dam/rackchiller-rack-manifold-spec-01500.pdf",
        scope: "product",
      },
      {
        title: "nVent RCM42001 model and installation manual (PDF)",
        url: "https://www.nvent.com/sites/default/files/acquiadam/assets/89216863.pdf",
        scope: "product",
      },
      nventFootprint,
    ],
  }),
  optics: reference({
    componentId: "optics",
    productName: "LinkX MMA4Z00-NS400",
    manufacturer: "NVIDIA",
    category: "Networking",
    summary:
      "A single-port OSFP optical transceiver for short multimode fiber links.",
    verifiedSpecs: [
      "400 Gb/s SR4 optical transceiver",
      "Up to 50 m multimode reach",
    ],
    fitNote:
      "A 400 Gb/s component reference, not a selected 800 Gb/s rack link. Host port, fiber, cooling and supported topology must match.",
    origin: unknownOrigin(
      "The manual's example country-of-origin label is explicitly illustrative and its serial-number legend lists alternative manufacturing sites. Neither identifies a real unit's origin."
    ),
    sources: [
      {
        title: "NVIDIA MMA4Z00-NS400 transceiver manual (PDF)",
        url: "https://docs.nvidia.com/mma4z00-ns400-400gb-s-single-port-osfp-400gb-s-multimode-sr4-50m-transceiver.pdf",
        scope: "product",
      },
    ],
  }),
  controls: reference({
    componentId: "controls",
    productName: "NetBotz Rack Monitor 250A (NBRK0250A)",
    manufacturer: "Schneider Electric / APC",
    category: "Controls",
    summary:
      "A rack appliance for environmental monitoring, access control and alerts.",
    verifiedSpecs: [
      "1U environmental and access-monitoring appliance",
      "Multiple rope leak sensors require supported 3.3.x or later firmware",
    ],
    fitNote:
      "An equipment reference only. FORMA is not connected to this appliance, and no real sensor telemetry is being received.",
    origin: unknownOrigin(),
    sources: [
      {
        title: "Schneider Electric NetBotz 250A specifications",
        url: "https://shop.se.com/pro/us/en/product/rack-mount-security-and-environmental-appliance-netbotz-250a/",
        scope: "product",
      },
      {
        title: "NetBotz 250A rope leak sensor firmware requirements",
        url: "https://www.se.com/us/en/faqs/FAQ000281400/",
        scope: "product",
        publishedAt: "2026-03-30",
      },
    ],
  }),
  enclosure: reference({
    componentId: "enclosure",
    productName: "SmartMod prefabricated enclosure family",
    manufacturer: "Vertiv",
    category: "Structure",
    summary: "Factory-built modular enclosures for data-center infrastructure.",
    verifiedSpecs: [
      "Prefabricated enclosure for modular data centers",
      "Power, cooling and monitoring integration are configurable",
    ],
    fitNote:
      "A real modular-enclosure reference, not NVIDIA DSX POD hardware. The roof animation, dimensions, structural rating and rack capacity in the model are illustrative.",
    origin: unknownOrigin(),
    sources: [
      {
        title: "Vertiv SmartMod enclosure family",
        url: "https://www.vertiv.com/en-us/products-catalog/facilities-enclosures-and-racks/integrated-solutions/vertiv-smartmod-solutions/",
        scope: "product",
      },
    ],
  }),
} satisfies Record<PartComponentId, PartReference>

function isPartComponentId(value: string): value is keyof typeof partCatalog {
  return Object.prototype.hasOwnProperty.call(partCatalog, value)
}

export function getPartReference(
  componentId: string
): PartReference | undefined {
  return isPartComponentId(componentId) ? partCatalog[componentId] : undefined
}
