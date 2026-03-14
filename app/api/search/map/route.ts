import { NextRequest, NextResponse } from "next/server";

const ELASTIC_URL = process.env.ELASTIC_URL;
const ELASTIC_API_KEY = process.env.ELASTIC_API_KEY;

/**
 * GET /api/search/map
 *
 * Returns uploads within a map viewport bounding box.
 *
 * Query params:
 *   - north (required): top latitude
 *   - south (required): bottom latitude
 *   - east (required): right longitude
 *   - west (required): left longitude
 *   - limit (optional): max results, default 100
 *
 * Example:
 *   /api/search/map?north=-37.7&south=-37.9&east=145.1&west=144.9
 */
export async function GET(req: NextRequest) {
  if (!ELASTIC_URL || !ELASTIC_API_KEY) {
    return NextResponse.json(
      { error: "Elasticsearch not configured" },
      { status: 503 }
    );
  }

  const params = req.nextUrl.searchParams;
  const north = parseFloat(params.get("north") ?? "");
  const south = parseFloat(params.get("south") ?? "");
  const east = parseFloat(params.get("east") ?? "");
  const west = parseFloat(params.get("west") ?? "");
  const limit = Math.min(parseInt(params.get("limit") ?? "100", 10) || 100, 500);

  // Validate required params
  if ([north, south, east, west].some(isNaN)) {
    return NextResponse.json(
      { error: "Missing or invalid bounds. Required: north, south, east, west" },
      { status: 400 }
    );
  }

  // Build Elastic geo_bounding_box query
  const query = {
    size: limit,
    query: {
      bool: {
        filter: [
          {
            geo_bounding_box: {
              geo: {
                top_left: { lat: north, lon: west },
                bottom_right: { lat: south, lon: east },
              },
            },
          },
        ],
      },
    },
    sort: [{ timestamp: "desc" }],
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
      console.error(`[/api/search/map] Elastic error ${res.status}:`, body);
      return NextResponse.json(
        { error: "Search failed" },
        { status: 502 }
      );
    }

    const data = await res.json();
    const hits = data.hits?.hits ?? [];

    return NextResponse.json({
      total: data.hits?.total?.value ?? hits.length,
      uploads: hits.map((hit: ElasticHit) => ({
        id: hit._source.upload_id,
        userId: hit._source.user_id,
        title: hit._source.title,
        description: hit._source.description,
        geo: hit._source.geo,
        locationName: hit._source.location_name,
        dominantClass: hit._source.dominant_class,
        tags: hit._source.tags,
        likes: hit._source.likes,
        listenCount: hit._source.listen_count,
        biodiversityScore: hit._source.biodiversity_score,
        durationSeconds: hit._source.duration_seconds,
        timestamp: hit._source.timestamp,
      })),
    });
  } catch (err) {
    console.error("[/api/search/map] Fetch error:", err);
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
}
