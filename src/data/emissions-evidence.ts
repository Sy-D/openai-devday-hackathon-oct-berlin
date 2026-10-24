import type { EmissionsBasis } from "../lib/procurement"

export const emissionsBasis: EmissionsBasis = {
  label: "2026 diesel passenger-car distance benchmark",
  kgCo2ePerKm: 0.17265,
  source: {
    title: "UK DESNZ 2026 factors · average diesel car · kg CO₂e/km",
    url: "https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026",
    observedAt: "2026-10-24T13:06:17Z",
  },
  note: "Distance × 0.17265 kg CO₂e/km. UK average diesel passenger car, direct operating emissions only (2026 revised flat file, Factors by Category row 1796, factor 4_301_3069_4_1). Matches the passenger-car vehicle class of the courier tariff; the carrier's actual vehicle and fuel are unknown. A comparison benchmark, not measured emissions of a German carrier. Excludes fuel supply, vehicle production, empty return legs and shipment allocation; assumes a dedicated car for a small part.",
}
