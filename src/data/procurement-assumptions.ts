import { getOffersForComponent } from "./procurement-offers"
import type { PartComponentId } from "./part-catalog"
import type {
  CostBasis,
  EmissionsBasis,
  EvidenceSource,
  ProcurementOffer,
} from "../lib/procurement"

const assumptionsRecordedAt = "2026-10-24T13:13:08Z"

/** Internal scenario inputs. None of these amounts is a supplier quote. */
const planningUnitPrices = {
  "compute-a": 3_200_000,
  "compute-b": 3_400_000,
  fabric: 32_000,
  storage: 150_000,
  power: 8_500,
  cooling: 72_000,
  manifold: 4_000,
  enclosure: 280_000,
} satisfies Partial<Record<PartComponentId, number>>

export const planningAssumptionSource: EvidenceSource = {
  title: "Internal planning assumptions; no external supplier confirmation",
  url: "/planning",
  observedAt: assumptionsRecordedAt,
}

function assumedDispatch(): NonNullable<ProcurementOffer["dispatch"]> {
  return {
    label: "Planning consolidation hub, Glinde, Germany",
    coordinates: [10.213583, 53.5411468],
    precision: "city",
    status: "assumed",
    note: "Glinde city is an assumed consolidation point for this scenario. It is not a verified factory, seller warehouse, loading bay or available pickup location for this offer.",
    source: planningAssumptionSource,
  }
}

const dispatchAssumption =
  "Dispatch location is a planning assumption: a consolidation hub at the Glinde city centroid. No seller dispatch or collection permission is confirmed."

function withDispatchAssumption(offer: ProcurementOffer): ProcurementOffer {
  if (!offer.price || offer.dispatch) {
    return { ...offer, dataMode: "observed" }
  }
  return {
    ...offer,
    dataMode: "observed",
    dispatch: assumedDispatch(),
    assumptions: [dispatchAssumption],
  }
}

/**
 * Preserve observed offers, prices and stock wording. A manufacturer reference
 * gets an explicitly estimated choice only when no priced seller offer exists.
 */
export function offersWithAssumptions(componentId: string): ProcurementOffer[] {
  const observed = getOffersForComponent(componentId)
  const offers = observed.map(withDispatchAssumption)
  if (observed.some((offer) => offer.price)) return offers

  const reference = observed[0]
  if (!reference) return offers
  const priceEntry = Object.entries(planningUnitPrices).find(
    ([id]) => id === componentId
  )
  if (!priceEntry) return offers

  const planningOffer: ProcurementOffer = {
    ...reference,
    id: `planning-${reference.componentId}`,
    seller: reference.seller.replace(" / sales partner", " planning reference"),
    dataMode: "assumed",
    price: { amount: priceEntry[1], currency: "EUR", vat: "excluded" },
    availability: "Supplier availability requires confirmation.",
    observedAt: assumptionsRecordedAt,
    dispatch: assumedDispatch(),
    assumptions: [
      "Unit price is an internally selected planning estimate, not a published supplier quote or researched market price.",
      "The estimate excludes VAT by assumption. Actual tax treatment, configuration and final seller pricing need confirmation.",
      dispatchAssumption,
      "No available inventory, collection date, installation scope or hardware compatibility is confirmed.",
    ],
    sources: [...reference.sources, planningAssumptionSource],
    note: "Manufacturer links establish the product identity only. The price and consolidation point are internal planning assumptions. The timestamp records when those assumptions were set, not a live supplier check. Request a configured supplier quote before procurement.",
  }

  return [planningOffer, ...offers]
}

export const assumptionCostBasis: CostBasis = {
  label: "Planning freight estimate",
  appliesTo: "planning-freight",
  fixedEur: 120,
  perKmEur: 1.6,
  includedKm: 0,
  minEur: 180,
  rounding: "whole-euro",
  source: planningAssumptionSource,
  note: "Internal dedicated-road-freight assumption: €120 dispatch allowance plus €1.60 per route kilometre, minimum €180, net of VAT. These amounts are not a carrier tariff or quote. Vehicle type, payload, packing, loading equipment, insurance, permits, night service, tolls, return legs and site access are unverified. Large rack, cooling and enclosure loads require a carrier survey; a passenger-car road route does not prove truck clearance or route suitability.",
}

export const assumptionEmissionsBasis: EmissionsBasis = {
  label: "Planning freight emissions estimate",
  kgCo2ePerKm: 0.9,
  source: planningAssumptionSource,
  note: "Internal scenario assumption of 0.90 kg CO₂e per route kilometre for a dedicated freight vehicle. This value is not a measured carrier result, a researched conversion factor or a certified footprint. Vehicle, fuel, payload and shipment allocation are unverified; fuel supply, vehicle production and empty return legs are excluded.",
}

/** Small purchasable parts retain their separately sourced passenger-car basis. */
export function getAssumptionBases(
  componentId: string
): { costBasis: CostBasis; emissionsBasis: EmissionsBasis } | undefined {
  if (!Object.hasOwn(planningUnitPrices, componentId)) return undefined
  return {
    costBasis: assumptionCostBasis,
    emissionsBasis: assumptionEmissionsBasis,
  }
}
