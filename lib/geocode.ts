/**
 * Geocoding helpers — thin wrappers around /api/geocode
 *
 * All calls go through our own Next.js API route (server-side Nominatim proxy)
 * so credentials and User-Agent are never exposed to the browser.
 */

export interface GeocodeResult {
  lat: number;
  lon: number;
  display_name: string;
  /** [south, north, west, east] — pass directly to Leaflet map.fitBounds() */
  boundingbox: [number, number, number, number];
}

/**
 * Geocode a free-text address and return up to 5 candidates.
 *
 * Usage:
 *   const results = await geocodeAddress("Fitzroy");
 *   // results[0] → { lat: -37.7963, lon: 144.9778, display_name: "Fitzroy, ...", boundingbox: [...] }
 *
 * Returns an empty array if nothing is found or the service is unavailable.
 */
export async function geocodeAddress(query: string): Promise<GeocodeResult[]> {
  if (!query.trim()) return [];

  try {
    const res = await fetch(
      `/api/geocode?q=${encodeURIComponent(query.trim())}`
    );

    // 404 = no results — not an error worth throwing
    if (res.status === 404) return [];

    if (!res.ok) {
      console.error(`[geocode] /api/geocode returned ${res.status}`);
      return [];
    }

    const data = await res.json();
    return (data.results as GeocodeResult[]) ?? [];
  } catch (err) {
    console.error("[geocode] fetch failed:", err);
    return [];
  }
}

/**
 * Convenience: geocode and return only the best match, or null.
 *
 * Usage:
 *   const loc = await geocodeBest("Fitzroy");
 *   if (loc) map.flyTo([loc.lat, loc.lon], 14);
 */
export async function geocodeBest(
  query: string
): Promise<GeocodeResult | null> {
  const results = await geocodeAddress(query);
  return results[0] ?? null;
}
