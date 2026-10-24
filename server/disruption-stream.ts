import {
  activeDisruptionsAt,
  disruptionTimeline,
  validDisruptionCursor,
  type DisruptionUpdate,
} from "../src/lib/dsx-state"

type StreamOptions = {
  intervalMs?: number
  heartbeatMs?: number
  lifetimeMs?: number
  now?: () => string
}

export function createDisruptionStream(
  request: Request,
  options: StreamOptions = {}
): Response {
  const url = new URL(request.url)
  // EventSource supplies Last-Event-ID after an automatic reconnect. The query
  // cursor restores a deliberately paused stream or a new route's connection.
  let cursor = validDisruptionCursor(
    request.headers.get("last-event-id") ?? url.searchParams.get("after")
  )
  const now = options.now ?? (() => new Date().toISOString())
  const encoder = new TextEncoder()
  let shutdown = () => {}
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false
      const intervals: Array<ReturnType<typeof setInterval>> = []
      const timeouts: Array<ReturnType<typeof setTimeout>> = []
      const cleanup = () => {
        intervals.forEach(clearInterval)
        timeouts.forEach(clearTimeout)
        request.signal.removeEventListener("abort", abort)
      }
      const finish = () => {
        if (closed) return
        closed = true
        cleanup()
        controller.close()
      }
      const abort = () => finish()
      shutdown = () => {
        closed = true
        cleanup()
      }
      const write = (text: string) => {
        if (!closed) controller.enqueue(encoder.encode(text))
      }
      const send = (
        change: DisruptionUpdate["change"],
        eventId: string | null
      ) => {
        const update: DisruptionUpdate = {
          version: 1,
          cursor,
          activeEventIds: activeDisruptionsAt(cursor),
          changedEventId: eventId,
          change,
          occurredAt: now(),
        }
        write(
          `id: ${cursor}\nevent: ${change === "snapshot" ? "snapshot" : "disruption"}\ndata: ${JSON.stringify(update)}\n\n`
        )
      }
      if (request.signal.aborted) {
        finish()
        return
      }
      request.signal.addEventListener("abort", abort, { once: true })
      write(
        "retry: 2000\n: Simulated DSX disruption feed. No external incident provider.\n\n"
      )
      send("snapshot", null)
      const eventTimer = setInterval(() => {
        const step = disruptionTimeline[cursor]
        if (!step) {
          clearInterval(eventTimer)
          return
        }
        cursor += 1
        send(step.active ? "activated" : "cleared", step.eventId)
      }, options.intervalMs ?? 15000)
      intervals.push(
        eventTimer,
        setInterval(
          () => write(": keepalive\n\n"),
          options.heartbeatMs ?? 10000
        )
      )
      // Keep requests bounded for managed hosts; EventSource resumes by cursor.
      timeouts.push(setTimeout(finish, options.lifetimeMs ?? 55000))
    },
    cancel() {
      shutdown()
    },
  })
  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
      "X-Disruption-Source": "simulated-scenario",
    },
  })
}
