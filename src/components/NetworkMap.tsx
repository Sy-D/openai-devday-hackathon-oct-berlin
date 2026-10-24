"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { factories, parts, type Factory } from "../data/network"
import { siteById, type Plan } from "../lib/planner"
import FactoryDetails from "./FactoryDetails"

const NetworkMapCanvas = dynamic(() => import("./NetworkMapCanvas"), {
  ssr: false,
  loading: () => (
    <div
      className="planning-map-frame flex items-center justify-center bg-muted text-sm text-muted-foreground"
      role="status"
    >
      Loading geographic map…
    </div>
  ),
})

export default function NetworkMap({
  plan,
  orderQuantity,
  onInspect,
  disrupted,
}: {
  plan: Plan
  orderQuantity: number
  onInspect?: (factory: Factory) => void
  disrupted: boolean
}) {
  const [inspected, setInspected] = useState<Factory | null>(null)
  const active = new Set([
    ...plan.legs.map((leg) => leg.factoryId),
    plan.assemblyId,
    "berlin",
  ])
  return (
    <div className="network-map">
      <NetworkMapCanvas
        plan={plan}
        orderQuantity={orderQuantity}
        disrupted={disrupted}
        onInspect={onInspect}
      />
      <div className="map-route-summary">
        <span>
          <strong>{plan.distanceKm.toLocaleString()} km</strong> combined
          distance
        </span>
        <span>{plan.legs.length + 1} transport legs · synthetic timing</span>
      </div>
      <ul className="map-route-list" aria-label="Selected route assignments">
        {plan.legs.map((leg) => (
          <li key={leg.partId}>
            <span>{parts.find((part) => part.id === leg.partId)?.name}</span>
            <strong>
              {siteById(leg.factoryId).city} → {siteById(plan.assemblyId).city}
            </strong>
          </li>
        ))}
        <li>
          <span>Assembly & delivery</span>
          <strong>{siteById(plan.assemblyId).city} → Berlin</strong>
        </li>
      </ul>
      <details className="map-locations">
        <summary>Inspect network locations · {factories.length}</summary>
        <div className="grid grid-cols-2 gap-1 p-2 sm:grid-cols-3">
          {factories.map((factory) => (
            <Button
              variant="ghost"
              className="h-auto min-h-11 justify-start text-left whitespace-normal"
              key={factory.id}
              aria-label={`Inspect ${factory.name}, ${factory.city}`}
              onClick={() => {
                setInspected(factory)
                onInspect?.(factory)
              }}
            >
              {factory.city}
              <span className="text-xs text-muted-foreground">
                {active.has(factory.id) ? "Selected" : "Alternative"}
              </span>
            </Button>
          ))}
        </div>
      </details>
      <Dialog
        open={inspected !== null}
        onOpenChange={(open) => {
          if (!open) setInspected(null)
        }}
      >
        <DialogContent className="forma-app" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{inspected?.name} details</DialogTitle>
          </DialogHeader>
          {inspected && (
            <FactoryDetails
              factory={inspected}
              orderQuantity={orderQuantity}
              disrupted={disrupted}
            />
          )}
          <DialogClose render={<Button variant="outline" className="h-11" />}>
            Close facility details
          </DialogClose>
        </DialogContent>
      </Dialog>
    </div>
  )
}
