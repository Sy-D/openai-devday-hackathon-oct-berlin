import type { PartAssessment, RouteAssessment } from "./dsx-routing"

export type RouteConfirmation = {
  componentId: string
  routeId: string
  cost: number
  etaHours: number
  confirmedAt: string
}

export function needsRouteReview(
  saved: RouteConfirmation | undefined,
  route: RouteAssessment
) {
  return (
    !!saved &&
    (!route.available ||
      route.bufferHours < 0 ||
      saved.cost !== route.cost ||
      saved.etaHours !== route.etaHours)
  )
}

export function deliveryStatus(
  assessment: PartAssessment,
  saved?: RouteConfirmation
): PartAssessment["status"] {
  if (assessment.status === "delivered" || assessment.status === "blocked")
    return assessment.status
  if (needsRouteReview(saved, assessment.route)) return "delayed"
  // An explicitly reviewed, unchanged delay with enough deadline buffer is
  // resolved for planning purposes. It is not proof of physical delivery.
  if (saved && assessment.route.available && assessment.route.bufferHours >= 0)
    return "on-track"
  return assessment.status
}
