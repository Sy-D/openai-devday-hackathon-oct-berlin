"use client"

import { ArrowUpRight, Radio, WifiOff } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { LiveIncident, LiveSourceStatus } from "@/src/lib/live-incidents"
import {
  evidenceLabels,
  formatIncidentTime,
  kindLabels,
  sourceNames,
  statusLabels,
} from "./incident-data"
import type { LiveIncidentState } from "./use-live-incidents"
import styles from "./incidents.module.css"

export function ConnectionStatus({
  connection,
}: Pick<LiveIncidentState, "connection">) {
  const connected = connection === "connected"
  const label = connected
    ? "Stream connected"
    : connection === "connecting"
      ? "Connecting to updates"
      : connection === "reconnecting"
        ? "Reconnecting · saved records"
        : "Waiting for connection"
  return (
    <span className={styles.connection} data-connected={connected}>
      {connected ? (
        <Radio size={14} aria-hidden />
      ) : (
        <WifiOff size={14} aria-hidden />
      )}
      {label}
    </span>
  )
}

export function SourceState({ state }: { state: LiveSourceStatus["state"] }) {
  const labels = {
    loading: "Loading",
    live: "Current",
    stale: "Stale",
    unavailable: "Unavailable",
    historical: "Historical",
  }
  return (
    <span className={styles.sourceState} data-state={state}>
      <span aria-hidden className={styles.statusDot} />
      {labels[state]}
    </span>
  )
}

export function IncidentCard({
  incident,
  sourceState,
}: {
  incident: LiveIncident
  sourceState?: LiveSourceStatus["state"]
}) {
  return (
    <article
      className={`${styles.incident} motion-safe:animate-row-in`}
      data-severity={incident.severity}
    >
      <div className={styles.incidentAccent} aria-hidden />
      <div className={styles.incidentBody}>
        <div className={styles.incidentMeta}>
          <span className={styles.sourceName}>
            {sourceNames[incident.sourceId]}
          </span>
          <span className={styles.metaDivider} aria-hidden>
            ·
          </span>
          <span>{kindLabels[incident.kind]}</span>
          {sourceState && sourceState !== "live" && (
            <SourceState state={sourceState} />
          )}
        </div>
        <h3>{incident.title}</h3>
        <p className={styles.location}>
          {[incident.location, incident.country]
            .filter(Boolean)
            .filter((value, index, all) => all.indexOf(value) === index)
            .join(" · ") || "Location not supplied"}
        </p>
        <div className={styles.badges}>
          <Badge
            variant="outline"
            className={styles.severity}
            data-severity={incident.severity}
          >
            {incident.severity === "unknown"
              ? "Severity not supplied"
              : `${incident.severity[0].toUpperCase()}${incident.severity.slice(1)} severity`}
          </Badge>
          <Badge variant="secondary">{statusLabels[incident.status]}</Badge>
          <Badge variant="outline">{evidenceLabels[incident.evidence]}</Badge>
        </div>
        {incident.description && (
          <details className={styles.recordDetails}>
            <summary>Report details</summary>
            <p>{incident.description}</p>
            {incident.attribution && (
              <p className={styles.attribution}>
                Attribution: {incident.attribution}
              </p>
            )}
            <dl className={styles.detailTimes}>
              <div>
                <dt>Event start</dt>
                <dd>{formatIncidentTime(incident.startedAt)}</dd>
              </div>
              {incident.endedAt && (
                <div>
                  <dt>Event end</dt>
                  <dd>{formatIncidentTime(incident.endedAt)}</dd>
                </div>
              )}
              <div>
                <dt>Provider record</dt>
                <dd>{incident.providerId || "Not supplied"}</dd>
              </div>
            </dl>
          </details>
        )}
        <div className={styles.recordFooter}>
          <div className={styles.timestamps}>
            <span>
              Source updated{" "}
              <time dateTime={incident.updatedAt}>
                {formatIncidentTime(incident.updatedAt)}
              </time>
            </span>
            <span>
              Fetched{" "}
              <time dateTime={incident.fetchedAt}>
                {formatIncidentTime(incident.fetchedAt)}
              </time>
            </span>
          </div>
          <a
            className={styles.sourceLink}
            href={incident.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View source for ${incident.title}`}
          >
            View source <ArrowUpRight size={15} aria-hidden />
          </a>
        </div>
      </div>
    </article>
  )
}
