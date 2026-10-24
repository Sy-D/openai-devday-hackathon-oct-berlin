import type { EmissionsBasis } from "../lib/procurement"

export const emissionsBasis: EmissionsBasis = {
  label: "2026 diesel van distance benchmark",
  kgCo2ePerKm: 0.25716,
  source: {
    title: "UK DESNZ 2026 factors · average diesel van · kg CO₂e/km",
    url: "https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026",
    observedAt: "2026-10-24T13:06:00Z",
  },
  note: "Distance × 0.25716 kg CO₂e/km. UK average diesel van up to 3.5 tonnes, direct operating emissions only (factor 5_303_3102_4_1). A comparison benchmark, not measured emissions of a German carrier. Excludes fuel supply, vehicle production, empty return legs and shipment allocation; assumes a dedicated van for a small part.",
}
