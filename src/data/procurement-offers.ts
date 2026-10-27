import { partCatalog, type PartComponentId } from "./part-catalog"
import type {
  DeliveryLocation,
  EvidenceSource,
  ProcurementOffer,
} from "../lib/procurement"

const checkedAt = "2026-10-24T13:01:08Z"
const deltaProductUrl =
  "https://www.deltacomputer.com/nvidia-mma4z00-ns400.html"
const deltaTermsUrl = "https://www.deltacomputer.com/agb"
const deltaProduct: EvidenceSource = {
  title: "DELTA exact NVIDIA MMA4Z00-NS400 offer",
  url: deltaProductUrl,
  observedAt: checkedAt,
}
const deltaTerms: EvidenceSource = {
  title: "DELTA terms: prices exclude VAT; warehouse in Glinde",
  url: deltaTermsUrl,
  observedAt: checkedAt,
}
const glindeGeocode: EvidenceSource = {
  title: "OpenStreetMap: Glinde city, not a loading bay",
  url: "https://www.openstreetmap.org/relation/454248",
  observedAt: "2026-10-24T13:03:00Z",
}
const bechtleUrl =
  "https://www.bechtle.com/shop/apc-netbotz-250a-ueberwachungssystem--4736963--p"
const tesUrl =
  "https://www.tes-itsolutions.com/product-page/nvidia-mellanox-mma4z00-ns400-transceiver-400gbps-ndr-osfp-mpo12-50m"

/**
 * Public seller observations, not reserved stock or confirmed orders.
 * Prices below were read from fresh HTTP responses, not search-result snippets.
 * Unknown dispatch locations are deliberately absent rather than inferred from offices.
 */
const pricedOffers: ProcurementOffer[] = [
  {
    id: "delta-mma4z00-ns400",
    componentId: "optics",
    seller: "DELTA Computer Products GmbH",
    sku: "MMA4Z00-NS400 / 980-9I51S-00NS00",
    productName: "NVIDIA MMA4Z00-NS400",
    condition: "not-specified",
    orderUrl: deltaProductUrl,
    orderMode: "inquiry",
    price: { amount: 1483.28, currency: "EUR", vat: "excluded" },
    availability:
      "Seller reports in stock (Auf Lager); quantity not published.",
    observedAt: checkedAt,
    dispatch: {
      label: "DELTA warehouse city: Glinde, Germany",
      coordinates: [10.213583, 53.5411468],
      precision: "city",
      status: "warehouse-city",
      note: "Seller terms explicitly state ex-warehouse Glinde. The map uses the city centroid; the warehouse loading bay, collection permission and this order's dispatch are not confirmed.",
      source: deltaTerms,
    },
    sources: [deltaProduct, deltaTerms, glindeGeocode],
    note: "B2B inquiry listing, not checkout confirmation. VAT and shipping are additional. Seller confirmation determines the final price and dispatch date. The published price is for one transceiver; fiber and other link components are separate.",
  },
  {
    id: "tes-mma4z00-ns400-refurbished",
    componentId: "optics",
    seller: "T.E.S IT-SOLUTIONS",
    sku: "MMA4Z00-NS400 (seller SKU: MMA4Z00-NS400_Refurbished)",
    productName: "NVIDIA Mellanox MMA4Z00-NS400, refurbished",
    condition: "refurbished",
    orderUrl: tesUrl,
    orderMode: "purchase",
    price: { amount: 475, currency: "EUR", vat: "unknown" },
    availability:
      "Seller reports in stock; 1–3 business days handling from EU stock.",
    observedAt: "2026-10-24T13:01:09Z",
    sources: [
      {
        title: "T.E.S refurbished exact-SKU listing and handling terms",
        url: tesUrl,
        observedAt: "2026-10-24T13:01:09Z",
      },
    ],
    note: "Recovered and tested hardware, not new. The page publishes a EUR price but does not establish VAT treatment or a specific dispatch address. EU stock is too broad to calculate a shipment route. Final taxes, shipping and quantity require checkout confirmation.",
  },
  {
    id: "bechtle-nbrk0250a",
    componentId: "controls",
    seller: "Bechtle",
    sku: "NBRK0250A (seller article: 4736963)",
    productName: "APC NetBotz 250A monitoring appliance",
    condition: "new",
    orderUrl: bechtleUrl,
    orderMode: "purchase",
    price: { amount: 582.99, currency: "EUR", vat: "excluded" },
    availability:
      "Seller reports 32 units available; estimated delivery 27 October, subject to order and destination.",
    observedAt: "2026-10-24T13:01:09Z",
    sources: [
      {
        title: "Bechtle NBRK0250A offer, price and availability",
        url: bechtleUrl,
        observedAt: "2026-10-24T13:01:09Z",
      },
    ],
    note: "Listed gross price €693.76 includes €110.77 VAT. A transaction charge is additional. The seller's displayed delivery estimate is not a promise to this destination, and its dispatch warehouse is not established.",
  },
]

const quoteSkus = {
  "compute-a": "SRS-GB300-NVL72 (configuration requires quotation)",
  "compute-b": "S7K95A (HPE GB300 NVL72 base system code)",
  fabric: "SN5600 (ordering configuration required)",
  storage: "AFF A1K (ordering configuration required)",
  power: "S6E21A",
  cooling: "CoolChip CDU 600 (ordering configuration required)",
  manifold: "RCM42001",
  optics: "MMA4Z00-NS400",
  controls: "NBRK0250A",
  enclosure: "SmartMod (enclosure configuration required)",
} satisfies Record<PartComponentId, string>

const quoteNotes = {
  "compute-a":
    "Rack configuration, cooling scope, regional supply and site services need a written quote. No verified public EUR offer or allocated rack stock is recorded.",
  "compute-b":
    "S7K95A is a base system ordering code. Scope, rack configuration and delivery require an HPE quotation; a base-code listing is not a complete priced rack.",
  fabric:
    "SN5600 is a product family with different software and ordering variants. No verified EUR offer, chosen variant or dispatch location is recorded.",
  storage:
    "The manufacturer publishes US public-sector list prices, but these are not EUR offers for a configured storage system delivered to Berlin. Drives, shelves, software and support require quotation.",
  power:
    "The S6E21A kit is documented in HPE QuickSpecs. Public EUR pricing, stock, underlying factory and dispatch are unverified.",
  cooling:
    "Manufacturer sales consultation is required for configuration and site conditions. No verified public EUR price or dispatch date is recorded.",
  manifold:
    "Exact RCM42001 is documented. A US distributor advertises a non-stock order path, but no fresh EUR offer or European dispatch point is verified here.",
  enclosure:
    "SmartMod is a configurable enclosure family, not a single selected orderable SKU. Dimensions, power, cooling, transport and price require a supplier quotation.",
} satisfies Partial<Record<PartComponentId, string>>

// Fresh source checks: direct HTTP for seven distinct sources; web retrieval for
// HPE and Supermicro after the direct requests timed out or returned HTTP 403.
// These are documentation observations, never observations of price or stock.
const documentationObservedAt = {
  "compute-a": "2026-10-24T13:06:47Z",
  "compute-b": "2026-10-24T13:06:47Z",
  fabric: "2026-10-24T13:06:09Z",
  storage: "2026-10-24T13:06:09Z",
  power: "2026-10-24T13:06:47Z",
  cooling: "2026-10-24T13:06:09Z",
  manifold: "2026-10-24T13:06:09Z",
  optics: "2026-10-24T13:06:10Z",
  controls: "2026-10-24T13:06:10Z",
  enclosure: "2026-10-24T13:06:10Z",
} satisfies Record<PartComponentId, string>

/** Manufacturer-source fallbacks show gaps; they do not claim a purchasable quote exists. */
const quoteOffers: ProcurementOffer[] = Object.values(partCatalog).map(
  (part) => {
    const source = part.sources.find((item) => item.scope === "product")!
    // SAFETY: the membership check narrows this fixed component ID to a key in quoteNotes.
    const quoteNote =
      part.componentId in quoteNotes
        ? quoteNotes[part.componentId as keyof typeof quoteNotes]
        : undefined
    return {
      id: `manufacturer-${part.componentId}`,
      componentId: part.componentId,
      seller: `${part.manufacturer} / sales partner`,
      sku: quoteSkus[part.componentId],
      productName: part.productName,
      condition: "not-specified",
      orderUrl: source.url,
      orderMode: "quote-required",
      availability: "Price, stock and dispatch need a supplier quote.",
      observedAt: documentationObservedAt[part.componentId],
      sources: [
        {
          title: source.title,
          url: source.url,
          observedAt: documentationObservedAt[part.componentId],
        },
      ],
      note: `${quoteNote ?? "Manufacturer documentation confirms the product identity only. This source link is not an order, a stock allocation or a delivery commitment."} Timestamp records a manufacturer-document review, not a price or stock check.`,
    }
  }
)

export const procurementOffers: ProcurementOffer[] = [
  ...pricedOffers,
  ...quoteOffers,
]

export function getOffersForComponent(componentId: string): ProcurementOffer[] {
  return procurementOffers.filter((offer) => offer.componentId === componentId)
}

export const demoDestination: DeliveryLocation = {
  label: "NTT Berlin 1, Nonnendammallee 15, Berlin",
  coordinates: [13.2376192, 52.5375121],
  note: "A real public data-center address used as a planning destination. No customer relationship, delivery booking or goods-receiving bay is implied. Coordinates identify the mapped site, not an approved access point.",
  source: {
    title: "NTT Berlin 1 official site address",
    url: "https://services.global.ntt/en-us/services-and-products/global-data-centers/global-locations/emea/berlin-1-data-center",
    observedAt: "2026-10-24T13:03:00Z",
  },
}

export const defaultDeliveryLocation = demoDestination

export const destinationCoordinateSource: EvidenceSource = {
  title: "OpenStreetMap: NTT BER1 site coordinates",
  url: "https://www.openstreetmap.org/way/30324253",
  observedAt: "2026-10-24T13:03:00Z",
}
