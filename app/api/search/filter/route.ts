import { NextRequest, NextResponse } from "next/server";

const ELASTIC_URL = process.env.ELASTIC_URL?.replace(/\/+$/, "");
const ELASTIC_API_KEY = process.env.ELASTIC_API_KEY;

/**
 * GET /api/search/filter
 *
 * Filter uploads by category tags and/or location name.
 *
 * Query params:
 *   - category (optional): comma-separated list of categories (e.g. "bird,insect")
 *   - location (optional): suburb or location text to match (e.g. "Fitzroy")
 *   - limit (optional): max results, default 50
 *
 * Examples:
 *   /api/search/filter?category=bird
 *   /api/search/filter?location=Fitzroy
 *   /api/search/filter?category=bird,insect&location=Melbourne
 *
 * If neither category nor location is provided, returns the 50 most recent uploads.
 */
export async function GET(req: NextRequest) {
  if (!ELASTIC_URL || !ELASTIC_API_KEY) {
    return NextResponse.json(
      { error: "Elasticsearch not configured" },
      { status: 503 }
    );
  }

  const params = req.nextUrl.searchParams;
  const categoryParam = params.get("category");
  const locationParam = params.get("location")?.trim();
  const limit = Math.min(parseInt(params.get("limit") ?? "50", 10) || 50, 200);

  // Parse categories into array
  const categories = categoryParam
    ? categoryParam.split(",").map((c) => c.trim().toLowerCase()).filter(Boolean)
    : [];

  // Build Elastic bool query
  const must: object[] = [];
  const filter: object[] = [];

  // Category filter — match any of the provided categories in dominant_class or tags
  if (categories.length > 0) {
    filter.push({
      bool: {
        should: [
          { terms: { dominant_class: categories } },
          { terms: { tags: categories } },
        ],
        minimum_should_match: 1,
      },
    });
  }

  // Location text match — fuzzy match on location_name
  if (locationParam) {
    must.push({
      match: {
        location_name: {
          query: locationParam,
          fuzziness: "AUTO",
        },
      },
    });
  }

  // Build the full query
  const query: Record<string, unknown> = {
    size: limit,
    sort: [{ timestamp: "desc" }],
  };

  // If no filters, just return recent uploads
  if (must.length === 0 && filter.length === 0) {
    query.query = { match_all: {} };
  } else {
    query.query = {
      bool: {
        ...(must.length > 0 && { must }),
        ...(filter.length > 0 && { filter }),
      },
    };
  }

  try {
    const res = await fetch(`${ELASTIC_URL}/soundscape-uploads/_search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `ApiKey ${ELASTIC_API_KEY}`,
      },
      body: JSON.stringify(query),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[/api/search/filter] Elastic error ${res.status}:`, body);
      return NextResponse.json(
        { error: "Search failed" },
        { status: 502 }
      );
    }

    const data = await res.json();
    const hits = data.hits?.hits ?? [];

    return NextResponse.json({
      total: data.hits?.total?.value ?? hits.length,
      filters: {
        categories: categories.length > 0 ? categories : null,
        location: locationParam || null,
      },
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
      })),
    });
  } catch (err) {
    console.error("[/api/search/filter] Fetch error:", err);
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
