"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Popup,
  Tooltip,
  useMap,
} from "react-leaflet"
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet"
import type { maplibreGL } from "@maplibre/maplibre-gl-leaflet"
import { useTheme } from "next-themes"
import {
  Crosshair,
  LoaderCircle,
  MapPin,
  Route,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import type {
  Coordinate,
  RoadRoute,
  RouteExposure,
} from "@/src/lib/procurement"
import "leaflet/dist/leaflet.css"
import styles from "./route-map.module.css"

function position(coordinate: Coordinate): [number, number] {
  return [coordinate[1], coordinate[0]]
}
function FitRoutes({
  routes,
  resetKey,
}: {
  routes: RoadRoute[]
  resetKey: number
}) {
  const map = useMap()
  const bounds: LatLngBoundsExpression = useMemo(
    () => routes.flatMap((route) => route.coordinates.map(position)),
    [routes]
  )
  useEffect(() => {
    if (bounds.length)
      map.fitBounds(bounds, { padding: [62, 64], maxZoom: 12, animate: false })
  }, [bounds, map, resetKey])
  return null
}

function MapControls({ onFit }: { onFit: () => void }) {
  const map = useMap()
  return (
    <div className={styles.controls}>
      <button type="button" aria-label="Zoom in" onClick={() => map.zoomIn()}>
        <ZoomIn size={18} />
      </button>
      <button type="button" aria-label="Zoom out" onClick={() => map.zoomOut()}>
        <ZoomOut size={18} />
      </button>
      <button type="button" aria-label="Fit all routes" onClick={onFit}>
        <Crosshair size={18} />
      </button>
    </div>
  )
}

type BasemapState = "loading" | "ready" | "fallback"
function Basemap({
  dark,
  onStatus,
}: {
  dark: boolean
  onStatus: (status: BasemapState) => void
}) {
  const map = useMap()
  const [useRaster, setUseRaster] = useState(true)
  useEffect(() => {
    let cancelled = false
    let layer: ReturnType<typeof maplibreGL> | undefined
    let timeout: ReturnType<typeof setTimeout> | undefined
    const attribution =
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://openfreemap.org/">OpenFreeMap</a>'
    const fallback = () => {
      if (cancelled) return
      clearTimeout(timeout)
      if (layer && map.hasLayer(layer)) map.removeLayer(layer)
      layer = undefined
      setUseRaster(true)
      onStatus("fallback")
    }
    async function initialize() {
      try {
        const [{ maplibreGL }, { setWorkerUrl }] = await Promise.all([
          import("@maplibre/maplibre-gl-leaflet"),
          import("maplibre-gl"),
        ])
        if (cancelled) return
        onStatus("loading")
        setWorkerUrl(
          new URL(
            "maplibre-gl/dist/maplibre-gl-worker.mjs",
            import.meta.url
          ).toString()
        )
        layer = maplibreGL({
          style: `/api/map-proxy/styles/${dark ? "dark" : "positron"}`,
          attributionControl: false,
        })
        layer.addTo(map)
        map.attributionControl?.addAttribution(attribution)
        const renderer = layer.getMaplibreMap()
        renderer.on("idle", () => {
          if (cancelled || !renderer.isStyleLoaded()) return
          clearTimeout(timeout)
          setUseRaster(false)
          onStatus("ready")
        })
        renderer.on("error", fallback)
        timeout = setTimeout(fallback, 12000)
      } catch {
        fallback()
      }
    }
    void initialize()
    return () => {
      cancelled = true
      clearTimeout(timeout)
      map.attributionControl?.removeAttribution(attribution)
      if (layer && map.hasLayer(layer)) map.removeLayer(layer)
    }
  }, [dark, map, onStatus])
  return useRaster ? (
    <TileLayer
      className={dark ? styles.darkRaster : styles.lightRaster}
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
    />
  ) : null
}

export default function RouteMap({
  routes,
  selectedId,
  exposures,
  onSelect,
  onAvoid,
  avoidDisabled = false,
}: {
  routes: RoadRoute[]
  selectedId: string
  exposures: RouteExposure[]
  onSelect: (id: string) => void
  onAvoid: (id: string) => void
  avoidDisabled?: boolean
}) {
  const { resolvedTheme } = useTheme()
  const dark = resolvedTheme === "dark"
  const [resetKey, setResetKey] = useState(0)
  const [basemapStatus, setBasemapStatus] = useState<BasemapState>("loading")
  const selected = routes.find((route) => route.id === selectedId) ?? routes[0]
  const first = routes[0]?.coordinates[0]
  const center: LatLngExpression = first ? position(first) : [52.52, 13.405]
  return (
    <div
      className={styles.mapFrame}
      role="region"
      aria-label="Road route map"
      data-theme={dark ? "dark" : "light"}
      data-basemap={basemapStatus}
    >
      <div className={styles.mapHeader}>
        <span>
          <Route size={16} />
          <strong>Delivery route</strong>
        </span>
        <small>
          {selected
            ? `${selected.distanceKm.toFixed(1)} km · ${(selected.durationSeconds / 3600).toFixed(1)} driving hours`
            : "Route comparison"}
        </small>
      </div>
      <div className={styles.mapStage}>
        <MapContainer
          center={center}
          zoom={7}
          zoomControl={false}
          scrollWheelZoom={false}
          zoomAnimation={false}
          fadeAnimation={false}
          markerZoomAnimation={false}
          className={styles.map}
        >
          <Basemap dark={dark} onStatus={setBasemapStatus} />
          <FitRoutes routes={routes} resetKey={resetKey} />
          <MapControls onFit={() => setResetKey((value) => value + 1)} />
          {selected && (
            <Polyline
              positions={selected.coordinates.map(position)}
              interactive={false}
              pathOptions={{
                color: dark ? "#142337" : "#fff",
                weight: 11,
                opacity: 0.95,
              }}
            />
          )}
          {[...routes]
            .sort(
              (a, b) =>
                Number(a.id === selectedId) - Number(b.id === selectedId)
            )
            .map((route) => (
              <Polyline
                key={route.id}
                positions={route.coordinates.map(position)}
                pathOptions={{
                  color:
                    route.id === selectedId
                      ? dark
                        ? "#78a7ff"
                        : "#326de6"
                      : dark
                        ? "#8490a5"
                        : "#8d99aa",
                  weight: route.id === selectedId ? 6 : 4,
                  dashArray: route.id === selectedId ? undefined : "7 6",
                  opacity: 0.9,
                }}
                eventHandlers={{ click: () => onSelect(route.id) }}
              >
                <Popup>
                  <strong>{route.label}</strong>
                  <p>
                    {route.distanceKm.toFixed(1)} km ·{" "}
                    {(route.durationSeconds / 3600).toFixed(1)} driving hours
                  </p>
                  <button onClick={() => onSelect(route.id)}>
                    Select route
                  </button>
                </Popup>
              </Polyline>
            ))}
          {first && (
            <CircleMarker
              center={position(first)}
              radius={7}
              pathOptions={{
                color: "#fff",
                fillColor: "#4f7fee",
                fillOpacity: 1,
                weight: 2,
              }}
            >
              <Tooltip
                permanent
                direction="top"
                offset={[0, -10]}
                className={styles.endpointLabel}
              >
                Origin
              </Tooltip>
              <Popup>Dispatch point used for this calculation</Popup>
            </CircleMarker>
          )}
          {routes[0]?.coordinates.at(-1) && (
            <CircleMarker
              center={position(
                routes[0].coordinates[routes[0].coordinates.length - 1]
              )}
              radius={7}
              pathOptions={{
                color: "#fff",
                fillColor: "#273549",
                fillOpacity: 1,
                weight: 2,
              }}
            >
              <Tooltip
                permanent
                direction="bottom"
                offset={[0, 10]}
                className={styles.endpointLabel}
              >
                Destination
              </Tooltip>
              <Popup>Delivery destination</Popup>
            </CircleMarker>
          )}
          {exposures
            .filter((exposure) => exposure.incident.coordinates)
            .map((exposure) => {
              const coordinates = exposure.incident.coordinates
              if (!coordinates) return null
              const paths =
                exposure.incident.geometry?.type === "LineString"
                  ? [exposure.incident.geometry.coordinates]
                  : (exposure.incident.geometry?.coordinates ?? [])
              return (
                <Fragment key={exposure.incident.id}>
                  {paths.map((path, index) => (
                    <Polyline
                      key={index}
                      positions={path.map(position)}
                      pathOptions={{
                        color: "#ef7654",
                        weight: 5,
                        dashArray: "5 5",
                        opacity: 0.8,
                      }}
                    >
                      <Popup>
                        {exposure.incident.title}
                        <p>
                          Provider-reported road stretch. Review direction and
                          restriction scope.
                        </p>
                      </Popup>
                    </Polyline>
                  ))}
                  <CircleMarker
                    center={position(coordinates)}
                    radius={7}
                    pathOptions={{
                      color: "#fff",
                      fillColor:
                        exposure.kind === "reported-restriction"
                          ? "#ef7654"
                          : "#d7a23b",
                      fillOpacity: 0.95,
                      weight: 2,
                    }}
                  >
                    <Popup>
                      <strong>{exposure.incident.title}</strong>
                      <p>
                        {exposure.distanceKm.toFixed(1)} km from route ·{" "}
                        {exposure.kind === "hazard"
                          ? "Hazard proximity"
                          : "Reported restriction nearby"}
                      </p>
                      <button
                        disabled={avoidDisabled}
                        onClick={() => onAvoid(exposure.incident.id)}
                      >
                        Calculate alternative around this report
                      </button>
                    </Popup>
                  </CircleMarker>
                </Fragment>
              )
            })}
        </MapContainer>
        {basemapStatus !== "ready" && (
          <div className={styles.mapStatus} role="status">
            {basemapStatus === "loading" ? (
              <>
                <LoaderCircle size={15} />
                Loading map detail… Routes are ready.
              </>
            ) : (
              <>
                <MapPin size={15} />
                Standard map view · route controls remain available
              </>
            )}
          </div>
        )}
      </div>
      <div className={styles.legend}>
        <span>
          <i />
          Selected route
        </span>
        <span>
          <i data-kind="alternative" />
          Alternative
        </span>
        <span>
          <i data-kind="report" />
          Reported incident
        </span>
        <button type="button" onClick={() => setResetKey((value) => value + 1)}>
          <Crosshair size={14} />
          Fit routes
        </button>
      </div>
      <p>
        Click a route to compare it. Incident points show proximity, not a
        confirmed road closure.
      </p>
    </div>
  )
}
