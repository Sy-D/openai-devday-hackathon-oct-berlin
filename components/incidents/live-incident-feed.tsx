"use client"

import Link from "next/link"
import { ArrowRight, ArrowUpRight, CircleAlert } from "lucide-react"
import { Card } from "@/components/ui/card"
import {
  formatIncidentTime,
  isCurrentIncident,
  kindLabels,
  sortIncidents,
  sourceNames,
  statusLabels,
} from "./incident-data"
import { useLiveIncidents } from "./use-live-incidents"
import styles from "./incidents.module.css"

/** Shared source feed. This does not assign incident impact to a simulated shipment. */
export function LiveIncidentFeed({
  limit = 4,
  className = "",
}: {
  limit?: number
  className?: string
}) {
  const { snapshot, connection, error } = useLiveIncidents()
  const current = sortIncidents(
    snapshot?.incidents.filter(isCurrentIncident) ?? []
  )
  const attention =
    snapshot?.sources.filter(
      (source) => source.state === "stale" || source.state === "unavailable"
    ) ?? []
  return (
    <section
      className={`${styles.compactFeed} ${className}`}
      aria-label="Live external incidents"
    >
      <div className={styles.compactHeader}>
        <div>
          <h2>Live incident watch</h2>
        </div>
        <Link className={styles.sourceLink} href="/incidents">
          All incidents <ArrowRight size={15} aria-hidden />
        </Link>
      </div>
      {(error ||
        attention.length > 0 ||
        connection === "reconnecting" ||
        connection === "unavailable") && (
        <p className={styles.compactWarning}>
          <CircleAlert size={14} aria-hidden />
          {error ||
            (connection === "reconnecting" || connection === "unavailable"
              ? "Reconnecting automatically; previously received records remain visible."
              : `${attention.length} source${attention.length === 1 ? "" : "s"} stale or unavailable. Coverage is incomplete.`)}
        </p>
      )}
      <div className={styles.compactRecords}>
        {current.slice(0, Math.max(1, limit)).map((incident) => (
          <Card
            size="sm"
            key={incident.id}
            className={styles.compactRecord}
            data-severity={incident.severity}
          >
            <div>
              <div className={styles.compactMeta}>
                <span>{sourceNames[incident.sourceId]}</span>
                <span>{kindLabels[incident.kind]}</span>
                <span>{statusLabels[incident.status]}</span>
              </div>
              <a href={incident.url} target="_blank" rel="noopener noreferrer">
                {incident.title}
                <ArrowUpRight size={14} aria-hidden />
              </a>
              <p>
                {incident.location ||
                  incident.country ||
                  "Location not supplied"}
              </p>
              <p>Source updated {formatIncidentTime(incident.updatedAt)}</p>
            </div>
          </Card>
        ))}
        {!current.length && (
          <p className={styles.compactEmpty}>
            {!snapshot
              ? "Waiting for verified provider records…"
              : attention.length
                ? "No current records available. Check provider health in the incident workspace."
                : "No current records reported by the connected sources."}
          </p>
        )}
      </div>
      <p className={styles.compactDisclaimer}>
        These reports are external evidence. Shipment impact still needs
        verification.
      </p>
    </section>
  )
}
