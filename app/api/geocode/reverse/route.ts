import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/geocode/reverse?lat=-37.814&lon=144.963
 *
 * Server-side proxy to Nominatim reverse geocoder.
 * Returns a short human-readable location label.
 */
export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat");
  const lon = req.nextUrl.searchParams.get("lon");

  if (!lat || !lon) {
    return NextResponse.json({ error: "Missing lat/lon" }, { status: 400 });
  }

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", lat);
  url.searchParams.set("lon", lon);
  url.searchParams.set("format", "json");
  url.searchParams.set("zoom", "14");
  url.searchParams.set("addressdetails", "1");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "SoundSoil/1.0 (unihack2026@soundsoil.app)",
        "Accept-Language": "en",
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) throw new Error(`Nominatim ${res.status}`);

    const data = await res.json();

    if (data.error) {
      return NextResponse.json({ label: `${parseFloat(lat).toFixed(4)}, ${parseFloat(lon).toFixed(4)}` });
    }

    // Build a short label: suburb + city, or just display_name first two parts
    const addr = data.address ?? {};
    const parts = [
      addr.suburb || addr.neighbourhood || addr.quarter || addr.village || addr.town,
      addr.city || addr.municipality || addr.county,
    ].filter(Boolean);

    const label = parts.length > 0
      ? parts.join(", ")
      : (data.display_name?.split(",").slice(0, 2).join(", ") ?? `${parseFloat(lat).toFixed(4)}, ${parseFloat(lon).toFixed(4)}`);

    return NextResponse.json({ label });
  } catch {
    return NextResponse.json({ label: `${parseFloat(lat).toFixed(4)}, ${parseFloat(lon).toFixed(4)}` });
  }
}
