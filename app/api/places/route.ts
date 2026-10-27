import { PlaceInputError, searchPlaces } from "@/server/place-search"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" }
  if (request.headers.get("sec-fetch-site") === "cross-site")
    return Response.json(
      { error: "Use place search from the application." },
      { status: 403, headers }
    )
  try {
    const places = await searchPlaces(
      new URL(request.url).searchParams.get("q") ?? ""
    )
    return Response.json(
      {
        places,
        attribution: "Photon · © OpenStreetMap contributors",
        sourceUrl: "https://www.openstreetmap.org/copyright",
      },
      { headers }
    )
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof PlaceInputError
            ? error.message
            : "Place search is unavailable. Your selected location is unchanged; try again shortly.",
      },
      { status: error instanceof PlaceInputError ? 400 : 503, headers }
    )
  }
}
