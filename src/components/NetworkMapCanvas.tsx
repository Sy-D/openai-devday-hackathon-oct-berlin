"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { MaplibreGL } from "@maplibre/maplibre-gl-leaflet"
import { useMap } from "react-leaflet"
import { TileLayer, type LatLngTuple, type LayerEvent } from "leaflet"
import {
  Map,
  MapTileLayer,
  MapMarker,
  MapPolyline,
  MapPopup,
  MapZoomControl,
  MapFullscreenControl,
} from "@/components/ui/map"
import { factories, type Factory } from "../data/network"
import { compatibility, siteById, type Plan } from "../lib/planner"
import { parts } from "../data/network"
import FactoryDetails from "./FactoryDetails"

function position(factory: Factory): LatLngTuple {
  const [longitude, latitude] = factory.coordinates
  return [latitude, longitude]
}

function MapViewport({ locations }: { locations: LatLngTuple[] }) {
  const map = useMap()
  useEffect(() => {
    map.fitBounds(locations, { padding: [48, 48], maxZoom: 7, animate: false })
    const observer = new ResizeObserver(() =>
      map.invalidateSize({ animate: false })
    )
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map, locations])
  return null
}

function MapBackgroundStatus() {
  const map = useMap()
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">(
    "loading"
  )
  const ready = useRef(false)
  useEffect(() => {
    const attribution =
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://openfreemap.org/">OpenFreeMap</a>'
    map.attributionControl.addAttribution(attribution)
    const cleanups: (() => void)[] = []
    const loaded = () => {
      ready.current = true
      setStatus("ready")
      map.attributionControl.removeAttribution(attribution)
    }
    const failed = () => {
      ready.current = false
      setStatus("unavailable")
    }
    const watchLayer = ({ layer }: LayerEvent) => {
      if (layer instanceof TileLayer) {
        // The registry's raster fallback can return access-denied imagery with HTTP 200.
        map.removeLayer(layer)
        failed()
        return
      }
      if (!(layer instanceof MaplibreGL)) return
      const background = layer.getMaplibreMap()
      let sourceFailed = false
      const loading = () => {
        ready.current = false
        setStatus("loading")
      }
      const error = () => {
        sourceFailed = true
        failed()
      }
      const styleLoaded = () => {
        sourceFailed = false
      }
      const idle = () => {
        if (
          !sourceFailed &&
          background.isStyleLoaded() &&
          background.areTilesLoaded()
        )
          loaded()
      }
      background.on("styledataloading", loading)
      background.on("style.load", styleLoaded)
      background.on("idle", idle)
      background.on("error", error)
      cleanups.push(() => {
        background.off("idle", idle)
        background.off("error", error)
        background.off("style.load", styleLoaded)
        background.off("styledataloading", loading)
      })
    }
    map.on("layeradd", watchLayer)
    const timer = setTimeout(() => {
      if (!ready.current) failed()
    }, 15000)
    return () => {
      clearTimeout(timer)
      map.attributionControl.removeAttribution(attribution)
      map.off("layeradd", watchLayer)
      cleanups.forEach((cleanup) => cleanup())
    }
  }, [map])
  return (
    <div
      className="planning-map-status"
      data-tile-status={status}
      hidden={status === "ready"}
      role="status"
    >
      {status === "unavailable"
        ? "Map background unavailable. Routes and location details remain available below."
        : status === "loading"
          ? "Loading map background…"
          : null}
    </div>
  )
}

export default function NetworkMapCanvas({
  plan,
  orderQuantity,
  disrupted,
  onInspect,
}: {
  plan: Plan
  orderQuantity: number
  disrupted: boolean
  onInspect?: (factory: Factory) => void
}) {
  const routeKey = [
    plan.assemblyId,
    ...plan.legs.map((leg) => leg.factoryId),
    "berlin",
  ].join(":")
  const locations = useMemo(
    () => routeKey.split(":").map((id) => position(siteById(id))),
    [routeKey]
  )
  const active = new Set([
    ...plan.legs.map((leg) => leg.factoryId),
    plan.assemblyId,
    "berlin",
  ])
  return (
    <div className="planning-map-frame" data-testid="planning-map">
      <Map
        center={position(siteById(plan.assemblyId))}
        zoom={6}
        minZoom={3}
        className="h-full min-h-0 rounded-none"
        attributionControl
        scrollWheelZoom={false}
        zoomAnimation={false}
        fadeAnimation={false}
        markerZoomAnimation={false}
        aria-label={`European production network showing the ${plan.name} route to Berlin`}
      >
        <MapBackgroundStatus />
        <MapTileLayer
          vectorStyleUrl="/api/map-proxy/styles/positron"
          darkVectorStyleUrl="/api/map-proxy/styles/dark"
        />
        <MapViewport locations={locations} />
        <MapZoomControl position="top-3 left-3" />
        <MapFullscreenControl position="top-3 right-3" />
        {plan.legs.map((leg) => (
          <MapPolyline
            key={leg.partId}
            className={
              leg.partId === "actuator"
                ? "stroke-muted-foreground stroke-[3]"
                : "stroke-foreground stroke-[3]"
            }
            positions={[
              position(siteById(leg.factoryId)),
              position(siteById(plan.assemblyId)),
            ]}
            pathOptions={{
              dashArray: leg.partId === "actuator" ? "5 5" : undefined,
            }}
          />
        ))}
        <MapPolyline
          className="stroke-[color:var(--risk-low)] stroke-[4]"
          positions={[
            position(siteById(plan.assemblyId)),
            position(siteById("berlin")),
          ]}
        />
        {factories.map((factory) => {
          const blocked =
            factory.kind === "print" &&
            !parts.some(
              (part) =>
                compatibility(factory, part, orderQuantity * part.perKit)
                  .length === 0
            )
          const delayed = factory.id === "dresden" && disrupted
          const state = blocked
            ? "Incompatible"
            : delayed
              ? "Queue +24h"
              : active.has(factory.id)
                ? "Selected"
                : "Alternative"
          return (
            <MapMarker
              key={factory.id}
              position={position(factory)}
              title={`Inspect ${factory.name}, ${factory.city}`}
              alt={`${factory.city} · ${state}`}
              iconAnchor={[22, 22]}
              icon={
                <span
                  className={`planning-map-marker ${active.has(factory.id) ? "selected" : ""} ${blocked || delayed ? "blocked" : ""}`}
                >
                  <span className="marker-dot" />
                  <span className="marker-label">
                    {factory.city}
                    {blocked ? " · ×" : delayed ? " · +24h" : ""}
                  </span>
                </span>
              }
              eventHandlers={{ click: () => onInspect?.(factory) }}
            >
              <MapPopup
                className="planning-map-popup animate-none"
                minWidth={230}
                maxWidth={280}
                autoPanPadding={[24, 24]}
              >
                <div className="grid gap-3 p-4 text-left">
                  <h3 className="pr-8 text-base font-medium">{factory.name}</h3>
                  <div className="text-xs font-medium">{state}</div>
                  <FactoryDetails
                    factory={factory}
                    orderQuantity={orderQuantity}
                    disrupted={disrupted}
                  />
                </div>
              </MapPopup>
            </MapMarker>
          )
        })}
      </Map>
    </div>
  )
}
