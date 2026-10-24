"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { MaplibreGL } from "@maplibre/maplibre-gl-leaflet"
import {
  TileLayer,
  type LatLngTuple,
  type Layer,
  type LayerEvent,
} from "leaflet"
import { useMap } from "react-leaflet"
import {
  Map as GeographicMap,
  MapTileLayer,
  MapMarker,
  MapPolyline,
  MapPopup,
  MapZoomControl,
} from "@/components/ui/map"
import { transportEdges, transportNodes } from "@/src/data/dsx"
import type { RouteAssessment } from "@/src/lib/dsx-routing"
import styles from "./dsx.module.css"

type TileStatus = "loading" | "ready" | "error"

function RouteViewport({
  positions,
  onStatus,
}: {
  positions: LatLngTuple[]
  onStatus: (status: TileStatus) => void
}) {
  const map = useMap()
  const initialPositions = useRef(positions)

  useEffect(() => {
    map.fitBounds(initialPositions.current, {
      padding: [48, 48],
      maxZoom: 9,
      animate: false,
    })
  }, [map])

  useEffect(() => {
    const cleanups: (() => void)[] = []
    const timeout = setTimeout(() => onStatus("error"), 12000)
    const failed = () => {
      clearTimeout(timeout)
      onStatus("error")
    }
    const ready = () => {
      clearTimeout(timeout)
      onStatus("ready")
    }
    function observeLayer(layer: Layer) {
      if (layer instanceof MaplibreGL) {
        const renderer = layer.getMaplibreMap()
        const layerReady = () => {
          if (renderer.isStyleLoaded() && renderer.areTilesLoaded()) ready()
        }
        const loading = () => onStatus("loading")
        renderer.on("styledataloading", loading)
        renderer.on("error", failed)
        renderer.on("idle", layerReady)
        cleanups.push(() => {
          renderer.off("styledataloading", loading)
          renderer.off("error", failed)
          renderer.off("idle", layerReady)
        })
      } else if (layer instanceof TileLayer) {
        map.removeLayer(layer)
        failed()
      }
    }
    const offline = () => failed()
    const layerAdded = ({ layer }: LayerEvent) => observeLayer(layer)
    map.eachLayer(observeLayer)
    map.on("layeradd", layerAdded)
    window.addEventListener("offline", offline)
    return () => {
      clearTimeout(timeout)
      map.off("layeradd", layerAdded)
      window.removeEventListener("offline", offline)
      cleanups.forEach((cleanup) => cleanup())
    }
  }, [map, onStatus])

  return null
}

export default function RecoveryMap({ route }: { route: RouteAssessment }) {
  const [tileStatus, setTileStatus] = useState<TileStatus>("loading")
  const stops = useMemo(() => {
    const edges = route.edgeIds.map((id) => {
      const edge = transportEdges.find((item) => item.id === id)
      if (!edge) throw new Error(`Unknown transport edge ${id}`)
      return edge
    })
    return [edges[0].from, ...edges.map((edge) => edge.to)].map((id) => {
      const node = transportNodes.find((item) => item.id === id)
      if (!node) throw new Error(`Unknown transport node ${id}`)
      const position: LatLngTuple = [node.coordinates[1], node.coordinates[0]]
      return { node, position }
    })
  }, [route.edgeIds])
  const positions = useMemo(() => stops.map((stop) => stop.position), [stops])

  return (
    <div
      className={styles.routeMap}
      data-testid="recovery-map"
      data-tile-status={tileStatus}
    >
      <div
        className={styles.mapCanvas}
        role="region"
        aria-label={`${route.name} geographic route`}
      >
        <GeographicMap
          center={positions[0]}
          zoom={4}
          attributionControl
          className="isolate z-0 h-full min-h-0 rounded-none"
          zoomAnimation={false}
          fadeAnimation={false}
          markerZoomAnimation={false}
        >
          <MapTileLayer
            vectorStyleUrl="/api/map-proxy/styles/positron"
            darkVectorStyleUrl="/api/map-proxy/styles/dark"
          />
          <RouteViewport positions={positions} onStatus={setTileStatus} />
          <MapPolyline
            positions={positions}
            className={styles.mapLine}
            pathOptions={{ dashArray: route.available ? undefined : "6 6" }}
          />
          {stops.map(({ node, position }, index) => (
            <MapMarker
              key={`${node.id}-${index}`}
              position={position}
              title={node.name}
              alt={node.name}
              iconAnchor={[22, 22]}
              icon={<span className={styles.mapMarker}>{index + 1}</span>}
            >
              <MapPopup>
                <strong>{node.name}</strong>
                <p>
                  {index === 0
                    ? "Supplier dispatch"
                    : index === stops.length - 1
                      ? "Berlin integration site"
                      : "Transfer point"}
                </p>
              </MapPopup>
            </MapMarker>
          ))}
          <MapZoomControl />
        </GeographicMap>
      </div>
      {tileStatus !== "ready" && (
        <p className={styles.mapStatus} role="status">
          {tileStatus === "error"
            ? "Map tiles unavailable. Route stops and delivery estimates remain available below."
            : "Loading geographic tiles…"}
        </p>
      )}
      <p className={styles.mapAttribution}>
        <a href="https://openfreemap.org/" target="_blank" rel="noreferrer">
          OpenFreeMap
        </a>{" "}
        ·{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          © OpenStreetMap contributors
        </a>
      </p>
    </div>
  )
}
