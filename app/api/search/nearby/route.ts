import { NextRequest, NextResponse } from "next/server";

const ELASTIC_URL = process.env.ELASTIC_URL;
const ELASTIC_API_KEY = process.env.ELASTIC_API_KEY;

/**
 * GET /api/search/nearby
 *
 * Returns uploads within a radius of a point (geo-distance query).
 *
 * Query params:
 *   - lat (required): center latitude
 *   - lon (required): center longitude
 *   - radius (optional): distance with unit, default "5km" (e.g. "10km", "500m")
 *   - limit (optional): max results, default 50
 *
 * Example:
 *   /api/search/nearby?lat=-37.814&lon=144.963&radius=3km
 */
export async function GET(req: NextRequest) {
  if (!ELASTIC_URL || !ELASTIC_API_KEY) {
    return NextResponse.json(
      { error: "Elasticsearch not configured" },
      { status: 503 }
    );
  }

  const params = req.nextUrl.searchParams;
  const lat = parseFloat(params.get("lat") ?? "");
  const lon = parseFloat(params.get("lon") ?? "");
  const radius = params.get("radius") || "5km";
  const limit = Math.min(parseInt(params.get("limit") ?? "50", 10) || 50, 200);

  // Validate required params
  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json(
      { error: "Missing or invalid coordinates. Required: lat, lon" },
      { status: 400 }
    );
  }

  // Build Elastic geo_distance query
  const query = {
    size: limit,
    query: {
      bool: {
        filter: [
          {
            geo_distance: {
              distance: radius,
              geo: { lat, lon },
            },
          },
        ],
      },
    },
    sort: [
      {
        _geo_distance: {
          geo: { lat, lon },
          order: "asc",
          unit: "km",
        },
      },
    ],
  };

  try {
    const res = await fetch(`${ELASTIC_URL}/soundsoil-uploads/_search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `ApiKey ${ELASTIC_API_KEY}`,
      },
      body: JSON.stringify(query),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[/api/search/nearby] Elastic error ${res.status}:`, body);
      return NextResponse.json(
        { error: "Search failed" },
        { status: 502 }
      );
    }

    const data = await res.json();
    const hits = data.hits?.hits ?? [];

    return NextResponse.json({
      total: data.hits?.total?.value ?? hits.length,
      center: { lat, lon },
      radius,
      hits: hits.map((hit: ElasticHit) => ({
        upload_id: hit._source.upload_id,
        user_id: hit._source.user_id,
        title: hit._source.title,
        description: hit._source.description,
        geo: hit._source.geo,
        location_name: hit._source.location_name,
        dominant_class: hit._source.dominant_class,
        tags: hit._source.tags,
        likes: hit._source.likes,
        listen_count: hit._source.listen_count,
        biodiversity_score: hit._source.biodiversity_score,
        duration_seconds: hit._source.duration_seconds,
        timestamp: hit._source.timestamp,
        // Distance from center (Elastic returns this in sort values)
        distance_km: hit.sort?.[0] ?? null,
      })),
    });
  } catch (err) {
    console.error("[/api/search/nearby] Fetch error:", err);
    return NextResponse.json(
      { error: "Search service unavailable" },
      { status: 502 }
    );
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ElasticHit {
  _source: {
    upload_id: string;
    user_id: string;
    title: string;
    description: string | null;
    geo: { lat: number; lon: number } | null;
    location_name: string | null;
    dominant_class: string | null;
    tags: string[];
    likes: number;
    listen_count: number;
    biodiversity_score: number | null;
    duration_seconds: number | null;
    timestamp: number;
  };
  sort?: [number];
}
