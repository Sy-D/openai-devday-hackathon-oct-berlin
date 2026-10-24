import type { CostBasis } from "../lib/procurement"

/** Public carrier tariff, not a booking or carrier quote for these addresses. */
export const transportCostBasis: CostBasis = {
  label: "HanseSprint PKW direct-service tariff estimate (net)",
  fixedEur: 6.9,
  firstKm: 50,
  firstKmRateEur: 1.5,
  perKmEur: 0.8,
  includedKm: 0,
  minEur: 39.9,
  multiplier: 1.45,
  source: {
    title: "HanseSprint public courier tariff",
    url: "https://www.hansesprint.de/preisrechner.html",
    observedAt: "2026-10-24T13:03:31Z",
  },
  note: "Public Hamburg/national PKW tariff for packages up to 100 kg: €6.90 base, €1.50/km for the first 50 km and €0.80/km thereafter; minimum €39.90 and 3 km, with 45% direct-service surcharge. Excludes 19% VAT. Baseline applies outside 20:00–06:00 and Sunday/public-holiday periods; those incur an additional 25% surcharge and are not covered by this estimate. Includes 15 minutes loading/unloading; extra waiting costs €50/hour. Collection permission, exact Glinde address, load suitability, optional services and final carrier price need confirmation. This is not a booking or guaranteed collection time.",
}
