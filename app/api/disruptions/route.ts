import { createDisruptionStream } from "@/server/disruption-stream"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export function GET(request: Request) {
  return createDisruptionStream(request)
}
