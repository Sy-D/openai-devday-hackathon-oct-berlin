import type { CostBasis, EvidenceSource } from "../lib/procurement"

export const hamburgPublicHolidays2026 = [
  "2026-01-01",
  "2026-04-03",
  "2026-04-06",
  "2026-05-01",
  "2026-05-14",
  "2026-05-25",
  "2026-10-03",
  "2026-10-31",
  "2026-12-25",
  "2026-12-26",
] as const

export const transportHolidaySource: EvidenceSource = {
  title: "Hamburg official public holidays, 2026",
  url: "https://www.hamburg.de/leben-in-hamburg/ferien-feiertage-termine-378818",
  observedAt: "2026-10-24T13:07:00Z",
}

/** Calculator source establishes the minimum, multiplier and rounding order. */
export const transportCalculationSources: EvidenceSource[] = [
  {
    title: "HanseSprint published tariff configuration",
    url: "https://www.hansesprint.de/assets/config.js?v=20260928c",
    observedAt: "2026-10-24T13:06:30Z",
  },
  {
    title: "HanseSprint published price calculation",
    url: "https://www.hansesprint.de/assets/site.js?v=20261006a",
    observedAt: "2026-10-24T13:06:30Z",
  },
]

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
  rounding: "whole-euro",
  timingSurcharge: {
    timeZone: "Europe/Berlin",
    nightStartHour: 20,
    nightEndHour: 6,
    sunday: true,
    dates: hamburgPublicHolidays2026,
    year: 2026,
    multiplier: 1.25,
  },
  source: {
    title: "HanseSprint public courier tariff",
    url: "https://www.hansesprint.de/preisrechner.html",
    observedAt: "2026-10-24T13:06:10Z",
  },
  note: "Public Hamburg/national PKW tariff for packages up to 100 kg: €6.90 base, €1.50/km for the first 50 km and €0.80/km thereafter; minimum €39.90 and 3 km, then 45% direct-service surcharge. The carrier calculator rounds above-minimum net prices to the nearest whole euro. Excludes 19% VAT. The intended pickup time in Europe/Berlin determines the further 25% surcharge for 20:00–06:00, Sunday or a verified Hamburg public holiday in 2026. Other years need a new calendar. Includes 15 minutes loading/unloading; extra waiting costs €50/hour and is not included. Collection permission, exact Glinde address, load suitability, optional services and final carrier price need confirmation. This is not a booking or guaranteed collection time.",
}
