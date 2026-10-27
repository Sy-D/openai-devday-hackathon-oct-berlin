"use client"

import { useEffect, useRef, useState } from "react"
import { MapPin, Search } from "lucide-react"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Coordinate } from "@/src/lib/procurement"
import styles from "./procurement.module.css"

const placesSchema = z.object({
  places: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      coordinates: z.tuple([
        z.number().min(-180).max(180),
        z.number().min(-90).max(90),
      ]),
      kind: z.string(),
    })
  ),
  attribution: z.string(),
  sourceUrl: z.string().url(),
})
type PlaceResults = z.infer<typeof placesSchema>

export function LocationSearch({
  name,
  selectedLabel,
  onSelect,
}: {
  name: "Dispatch" | "Destination"
  selectedLabel: string
  onSelect: (label: string, coordinates: Coordinate) => void
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<PlaceResults | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])

  async function search() {
    if (query.trim().length < 3) return
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setError("")
    setResults(null)
    try {
      const response = await fetch(
        `/api/places?q=${encodeURIComponent(query.trim())}`,
        {
          signal: controller.signal,
        }
      )
      if (!response.ok)
        throw new Error(
          "Place search is unavailable. Your selected location is unchanged; try again shortly."
        )
      const parsed = placesSchema.safeParse(await response.json())
      if (!parsed.success)
        throw new Error(
          "Place search returned an incomplete response. Try a city or street address."
        )
      if (!controller.signal.aborted) setResults(parsed.data)
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "Place search is unavailable. Try again shortly."
        )
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  return (
    <div className={styles.placeSearch}>
      <div
        className={styles.selectedLocation}
        aria-label={`Selected ${name.toLowerCase()} location`}
      >
        <MapPin size={15} />
        <div>
          <span>Selected location</span>
          <strong>{selectedLabel || "Select a location below"}</strong>
        </div>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void search()
        }}
      >
        <label htmlFor={`${name}-place-search`}>
          Find a city, address or facility
        </label>
        <div className={styles.placeSearchRow}>
          <Input
            id={`${name}-place-search`}
            aria-label={`${name} address search`}
            placeholder="e.g. Hamburg, Berlin or a street address"
            value={query}
            onChange={(event) => {
              request.current?.abort()
              setBusy(false)
              setQuery(event.target.value)
              setResults(null)
              setError("")
            }}
          />
          <Button
            type="submit"
            variant="outline"
            disabled={busy || query.trim().length < 3}
            aria-label={`Search ${name.toLowerCase()} locations`}
          >
            <Search size={14} />
            {busy ? "Searching…" : "Search"}
          </Button>
        </div>
      </form>
      {error && <p role="alert">{error}</p>}
      {results && (
        <div aria-live="polite">
          {results.places.length ? (
            <ul
              className={styles.placeResults}
              aria-label={`${name} search results`}
            >
              {results.places.map((place) => (
                <li key={place.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(place.label, place.coordinates)
                      setQuery("")
                      setResults(null)
                    }}
                  >
                    <MapPin size={15} />
                    <span>
                      {place.label}
                      <small>{place.kind}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No locations found. Try a nearby city or a fuller street address.
            </p>
          )}
          <p className={styles.placeAttribution}>
            Place search:{" "}
            <a
              href={results.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {results.attribution}
            </a>
          </p>
        </div>
      )}
    </div>
  )
}
