import type { Metadata } from "next"
import { AppShell } from "@/components/dashboard/app-shell"
import { ProductionPlanning } from "./production-planning"
import "@/src/styles.css"

export const metadata: Metadata = {
  title: "Production planning | FORMA",
  description: "Review required actions, compare manufacturing routes and test production scenarios.",
}

export default function PlanningPage() {
  return (
    <AppShell breadcrumb={["Workspace", "Production planning"]}>
      <div id="main" className="min-w-0 flex-1" tabIndex={-1}>
        <ProductionPlanning />
      </div>
    </AppShell>
  )
}
