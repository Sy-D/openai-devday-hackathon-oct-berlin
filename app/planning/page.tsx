import type { Metadata } from "next"
import { notFound } from "next/navigation"
import ComponentRecovery from "@/components/dsx/component-recovery"
import { dsxParts } from "@/src/data/dsx"
import { AppShell } from "@/components/dashboard/app-shell"
import { ProductionPlanning } from "./production-planning"
import "@/src/styles.css"

export const metadata: Metadata = {
  title: "Production planning | FORMA",
  description:
    "Review required actions, compare manufacturing routes and test production scenarios.",
}

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ component?: string }>
}) {
  const { component } = await searchParams
  if (component && !dsxParts.some((part) => part.id === component)) notFound()
  if (component)
    return (
      <AppShell breadcrumb={["Workspace", "Component recovery"]}>
        <ComponentRecovery key={component} componentId={component} />
      </AppShell>
    )
  return (
    <AppShell breadcrumb={["Workspace", "Production planning"]}>
      <div id="main" className="min-w-0 flex-1" tabIndex={-1}>
        <ProductionPlanning />
      </div>
    </AppShell>
  )
}
