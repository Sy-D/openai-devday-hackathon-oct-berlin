import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ProcurementWorkbench } from "@/components/procurement/procurement-workbench"
import { getPartReference } from "@/src/data/part-catalog"

export const metadata: Metadata = {
  title: "Delivery planning | FORMA",
  description:
    "Choose a sourced product and compare real road routes against reported incidents.",
}
export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ component?: string }>
}) {
  const { component = "optics" } = await searchParams
  const part = getPartReference(component)
  if (!part) notFound()
  return (
    <ProcurementWorkbench
      key={part.componentId}
      componentId={part.componentId}
    />
  )
}
