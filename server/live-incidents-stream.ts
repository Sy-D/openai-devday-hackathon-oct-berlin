import { liveIncidentHub, type IncidentHub } from "./live-incidents"

export function createLiveIncidentStream(
  request: Request,
  options: { hub?: IncidentHub; lifetimeMs?: number; heartbeatMs?: number } = {}
): Response {
  const hub = options.hub ?? liveIncidentHub
  const encoder = new TextEncoder()
  let cancel = () => {}
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false
      let unsubscribe = () => {}
      const timers: Array<ReturnType<typeof setTimeout>> = []
      const cleanup = () => {
        unsubscribe()
        timers.forEach(clearTimeout)
        request.signal.removeEventListener("abort", finish)
      }
      function finish() {
        if (!closed) {
          closed = true
          cleanup()
          controller.close()
        }
      }
      cancel = () => {
        closed = true
        cleanup()
      }
      function write(message: string) {
        if (closed) return
        // A slow disconnected consumer must not accumulate an unbounded queue.
        if (controller.desiredSize !== null && controller.desiredSize < -1) {
          finish()
          return
        }
        controller.enqueue(encoder.encode(message))
      }
      if (request.signal.aborted) {
        finish()
        return
      }
      request.signal.addEventListener("abort", finish, { once: true })
      write("retry: 3000\n: Provider snapshots; no simulated fallback.\n\n")
      unsubscribe = hub.subscribe((snapshot) =>
        write(
          `id: ${snapshot.revision}\nevent: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`
        )
      )
      timers.push(
        setInterval(
          () => write(": keepalive\n\n"),
          options.heartbeatMs ?? 10_000
        )
      )
      timers.push(setTimeout(finish, options.lifetimeMs ?? 55_000))
    },
    cancel() {
      cancel()
    },
  })
  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
      "X-Incident-Source": "external-providers",
    },
  })
}
