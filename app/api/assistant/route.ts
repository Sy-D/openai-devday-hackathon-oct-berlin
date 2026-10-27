export const runtime = "nodejs"

export async function POST() {
  return Response.json(
    {
      error:
        "The simulated production assistant has been retired. Use the sourced delivery workflow at /planning.",
    },
    { status: 410 }
  )
}
