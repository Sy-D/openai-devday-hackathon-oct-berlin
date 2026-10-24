"use client"

import Link from "next/link"
import { ArrowRight, ArrowUpRight, CircleAlert } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  formatIncidentTime,
  isCurrentIncident,
  kindLabels,
  sortIncidents,
  sourceNames,
  statusLabels,
} from "./incident-data"
import { ConnectionStatus } from "./incident-primitives"
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
          <p className={styles.eyebrow}>Source-reported events</p>
          <h2>Live incident watch</h2>
        </div>
        <Link className={styles.sourceLink} href="/incidents">
          All incidents <ArrowRight size={15} aria-hidden />
        </Link>
      </div>
      <div className={styles.compactStatus}>
        <ConnectionStatus connection={connection} />
        <span>
          {snapshot
            ? `${current.length.toLocaleString()} current records`
            : "Loading providers…"}
        </span>
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
          <article
            key={incident.id}
            className={styles.compactRecord}
            data-severity={incident.severity}
          >
            <span className={styles.compactDot} aria-hidden />
            <div>
              <div className={styles.compactMeta}>
                <span>
                  {sourceNames[incident.sourceId]} · {kindLabels[incident.kind]}
                </span>
                <Badge variant="outline">{statusLabels[incident.status]}</Badge>
              </div>
              <a href={incident.url} target="_blank" rel="noopener noreferrer">
                {incident.title}
                <ArrowUpRight size={14} aria-hidden />
              </a>
              <p>
                {incident.location ||
                  incident.country ||
                  "Location not supplied"}{" "}
                · Source updated {formatIncidentTime(incident.updatedAt)}
              </p>
            </div>
          </article>
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
