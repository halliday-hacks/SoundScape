import { NextResponse } from "next/server";

const ELASTIC_URL = process.env.ELASTIC_URL?.replace(/\/+$/, "");
const ELASTIC_API_KEY = process.env.ELASTIC_API_KEY;
const INDEX = "soundscape-uploads";

const MAPPINGS = {
  mappings: {
    properties: {
      upload_id:          { type: "keyword" },
      user_id:            { type: "keyword" },
      title:              { type: "text" },
      description:        { type: "text" },
      timestamp:          { type: "date" },
      geo:                { type: "geo_point" },
      location_name:      { type: "text" },
      dominant_class:     { type: "keyword" },
      tags:               { type: "keyword" },
      likes:              { type: "integer" },
      listen_count:       { type: "integer" },
      biodiversity_score: { type: "float" },
      duration_seconds:   { type: "float" },
    },
  },
};

/**
 * GET /api/admin/elastic-setup
 *
 * Creates the soundscape-uploads index with the correct mappings (including
 * geo as geo_point) if it doesn't exist yet.
 *
 * If the index already exists but geo is mapped wrong, it deletes and recreates it.
 * Call this once from the browser or curl to fix the "failed to find geo field" error.
 */
export async function GET() {
  if (!ELASTIC_URL || !ELASTIC_API_KEY) {
    return NextResponse.json({ error: "Elasticsearch not configured" }, { status: 503 });
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `ApiKey ${ELASTIC_API_KEY}`,
  };

  // 1. Check if index exists and what mapping geo has
  const checkRes = await fetch(`${ELASTIC_URL}/${INDEX}/_mapping`, { headers });

  if (checkRes.ok) {
    const mapping = await checkRes.json();
    const geoType = mapping[INDEX]?.mappings?.properties?.geo?.type;

    if (geoType === "geo_point") {
      return NextResponse.json({ ok: true, message: "Index already has correct geo_point mapping — nothing to do." });
    }

    // Wrong mapping — delete and recreate
    console.log(`[elastic-setup] geo mapped as "${geoType ?? "unknown"}" — deleting index to recreate with correct mapping`);
    const delRes = await fetch(`${ELASTIC_URL}/${INDEX}`, { method: "DELETE", headers });
    if (!delRes.ok) {
      const body = await delRes.text();
      return NextResponse.json({ error: `Failed to delete index: ${body}` }, { status: 500 });
    }
  }

  // 2. Create index with explicit mappings
  const createRes = await fetch(`${ELASTIC_URL}/${INDEX}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(MAPPINGS),
  });

  if (!createRes.ok) {
    const body = await createRes.text();
    return NextResponse.json({ error: `Failed to create index: ${body}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: `Index "${INDEX}" created with geo_point mapping. Documents will re-sync automatically via the Convex cron sweep.`,
  });
}
