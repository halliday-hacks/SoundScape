import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/geocode?q=Fitzroy
 *
 * Server-side proxy to Nominatim (OpenStreetMap geocoder).
 * Keeping this server-side means:
 *  - We control the User-Agent header (Nominatim requires one)
 *  - We can add caching headers
 *  - The client never talks to a third-party directly
 *
 * Returns the top match as { lat, lon, display_name } or 404 if nothing found.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();

  if (!q) {
    return NextResponse.json(
      { error: "Missing query param: q" },
      { status: 400 }
    );
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  // Bias results toward Australia
  url.searchParams.set("countrycodes", "au");
  // Ask for a bounding box so the frontend can fly the map to the right zoom level
  url.searchParams.set("polygon_geojson", "0");
  url.searchParams.set("addressdetails", "1");

  let data: NominatimResult[];
  try {
    const res = await fetch(url.toString(), {
      headers: {
        // Nominatim policy: must include a descriptive User-Agent
        "User-Agent": "SoundSoil/1.0 (unihack2026@soundsoil.app)",
        "Accept-Language": "en",
      },
      // Cache for 60 seconds at the CDN/Next.js layer — geocode results don't change often
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      throw new Error(`Nominatim responded with ${res.status}`);
    }

    data = await res.json();
  } catch (err) {
    console.error("[geocode] Nominatim fetch failed:", err);
    return NextResponse.json(
      { error: "Geocoding service unavailable" },
      { status: 502 }
    );
  }

  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: "No results found", results: [] },
      { status: 404 }
    );
  }

  // Return the top 5 candidates so the frontend can show a suggestion dropdown
  const results: GeocodeResult[] = data.map((item) => ({
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
    display_name: item.display_name,
    // Bounding box: [south, north, west, east] — useful for map.fitBounds()
    boundingbox: item.boundingbox.map(parseFloat) as [
      number,
      number,
      number,
      number,
    ],
  }));

  return NextResponse.json({ results });
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  boundingbox: string[]; // [south, north, west, east]
}

export interface GeocodeResult {
  lat: number;
  lon: number;
  display_name: string;
  boundingbox: [number, number, number, number];
}
