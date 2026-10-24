"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Activity,
  Pause,
  Play,
  Radio,
  RotateCcw,
  TriangleAlert,
  X,
} from "lucide-react"
import { disruptionEvents } from "@/src/data/dsx"
import { useDisruptions } from "./use-disruptions"
import styles from "./dsx.module.css"

export function IncomingAlert() {
  const { lastEvent, lastReceivedAt, events } = useDisruptions()
  const [dismissed, setDismissed] = useState<string | null>(null)
  const incident = events.find((event) => event.id === lastEvent?.eventId)
  if (!incident || !lastEvent || dismissed === lastReceivedAt) return null
  return (
    <div className={styles.incomingAlert} role="status">
      <Radio size={17} />
      <div>
        <strong>
          {lastEvent.change === "activated"
            ? "New scenario alert"
            : "Scenario cleared"}
          : {incident.title}
        </strong>
        <span>Delivery states and route options have been recalculated.</span>
      </div>
      <a href="#disruption-feed-title">View incidents</a>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Dismiss incoming alert"
        onClick={() => setDismissed(lastReceivedAt)}
      >
        <X size={14} />
      </Button>
    </div>
  )
}

export function FeedStatus() {
  const { connection } = useDisruptions()
  return (
    <span className={styles.feedStatus} data-state={connection}>
      <Radio size={13} />
      {connection === "connected"
        ? "Scenario feed connected"
        : connection === "paused"
          ? "Scenario feed paused"
          : connection === "reconnecting"
            ? "Reconnecting to feed"
            : "Connecting to feed"}
    </span>
  )
}

export function DisruptionFeed() {
  const {
    activeEventIds,
    events,
    streamEnabled,
    setStreamEnabled,
    toggleEvent,
    resetScenario,
    connection,
  } = useDisruptions()
  return (
    <Card
      role="region"
      className={styles.feed}
      aria-labelledby="disruption-feed-title"
    >
      <CardHeader className={styles.sectionHeading}>
        <div>
          <CardTitle>
            <h2 id="disruption-feed-title">Scenario incidents</h2>
          </CardTitle>
          <CardDescription>
            Simulated events stream from the server. Route options update
            automatically.
          </CardDescription>
        </div>
        <div className={styles.inlineActions}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStreamEnabled(!streamEnabled)}
          >
            {streamEnabled ? <Pause size={14} /> : <Play size={14} />}{" "}
            {streamEnabled ? "Pause feed" : "Resume feed"}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={resetScenario}
            aria-label="Reset disruption scenario"
          >
            <RotateCcw size={15} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className={styles.feedMeta}>
          <FeedStatus />
          <span>
            {activeEventIds.length} active incidents · {disruptionEvents.length}{" "}
            scenarios
          </span>
        </div>
        <div
          className={styles.eventGrid}
          aria-live="polite"
          aria-relevant="additions text"
        >
          {events
            .filter((event) => activeEventIds.includes(event.id))
            .map((event) => (
              <Card size="sm" key={event.id} className={styles.eventCard}>
                <CardHeader>
                  <div className={styles.eventTop}>
                    <span className={styles.incidentKind}>
                      <TriangleAlert size={13} />
                      {event.kind}
                    </span>
                    <Badge
                      variant="secondary"
                      className={styles.pill}
                      data-status={event.blocked ? "blocked" : "delayed"}
                    >
                      {event.blocked ? "Link closed" : `+${event.delayHours}h`}
                    </Badge>
                  </div>
                  <CardTitle>
                    <h3>{event.title}</h3>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p>{event.description}</p>
                </CardContent>
                <CardFooter className={styles.eventBottom}>
                  <span>{event.location}</span>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => toggleEvent(event.id)}
                    aria-label={`Clear ${event.title}`}
                  >
                    Clear scenario
                  </Button>
                </CardFooter>
              </Card>
            ))}
          {activeEventIds.length === 0 && (
            <div className={styles.empty}>
              <Activity size={20} />
              <strong>No active disruptions</strong>
              <span>
                {connection === "paused"
                  ? "Resume the feed or activate a scenario below."
                  : "The feed is listening for the next simulated event."}
              </span>
            </div>
          )}
        </div>
        <details className={styles.scenarioControls}>
          <summary>
            Scenario controls{" "}
            <span>Air · rail · road · port · weather · supplier</span>
          </summary>
          <div className={styles.scenarioGrid}>
            {disruptionEvents.map((event) => (
              <label key={event.id}>
                <Checkbox
                  checked={activeEventIds.includes(event.id)}
                  onCheckedChange={() => toggleEvent(event.id)}
                />
                <span>
                  {event.title}
                  <small>
                    {event.location} ·{" "}
                    {event.blocked
                      ? "Closes affected links"
                      : `Adds ${event.delayHours}h`}
                  </small>
                </span>
              </label>
            ))}
          </div>
        </details>
      </CardContent>
    </Card>
  )
}
