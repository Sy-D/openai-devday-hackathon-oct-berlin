import { liveIncidentHub } from "@/server/live-incidents"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET() {
  return Response.json(await liveIncidentHub.getSnapshot(), {
    headers: {
      "Cache-Control": "no-store",
      "X-Incident-Source": "external-providers",
    },
  })
}
