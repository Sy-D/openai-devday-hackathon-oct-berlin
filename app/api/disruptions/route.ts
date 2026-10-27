export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export function GET() {
  return Response.json(
    {
      error:
        "Scripted disruptions have been retired. Use /api/incidents/stream for provider reports.",
    },
    { status: 410 }
  )
}
