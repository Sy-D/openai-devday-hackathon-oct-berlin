"use client"

import { useSyncExternalStore } from "react"
import App from "@/src/App"

const subscribe = () => () => {}
const browserReady = () => true
const serverReady = () => false

export function ProductionPlanning() {
  // Render the same placeholder on the server and during hydration. Saved demo
  // state is read by App only after hydration, and again on each route mount.
  const ready = useSyncExternalStore(subscribe, browserReady, serverReady)

  if (!ready) {
    return (
      <div className="p-6 lg:p-8" role="status">
        Loading production planning…
      </div>
    )
  }

  return <App />
}
