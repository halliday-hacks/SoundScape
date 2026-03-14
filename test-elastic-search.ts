import * as fs from "fs";
import * as path from "path";

// Load environment variables from .env.local if present
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  envContent.split("\n").forEach((line) => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

const ELASTIC_URL = process.env.ELASTIC_URL;
const ELASTIC_API_KEY = process.env.ELASTIC_API_KEY;

if (!ELASTIC_URL || !ELASTIC_API_KEY) {
  console.error("❌ Missing ELASTIC_URL or ELASTIC_API_KEY in environment or .env.local");
  process.exit(1);
}

const INDEX_NAME = "soundsoil-uploads";

async function runElasticQuery(endpointName: string, queryBody: any) {
  console.log(`\n🔍 Executing: ${endpointName}`);
  console.log(`   Query: ${JSON.stringify(queryBody, null, 2).replace(/\n/g, "\n   ")}`);
  
  try {
    const res = await fetch(`${ELASTIC_URL}/${INDEX_NAME}/_search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `ApiKey ${ELASTIC_API_KEY}`,
      },
      body: JSON.stringify(queryBody),
    });

    const data = await res.json();
    
    if (res.ok) {
      console.log(`✅ SUCCESS (${res.status})`);
      const totalHits = data.hits?.total?.value ?? 0;
      console.log(`   Found ${totalHits} results`);
      if (totalHits > 0) {
        const firstHit = data.hits.hits[0]._source;
        console.log(`   First result title: "${firstHit.title}" at lat: ${firstHit.geo?.lat}, lon: ${firstHit.geo?.lon}`);
      }
    } else {
      console.error(`❌ FAILED (${res.status})`);
      console.error(`   Error: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.error(`❌ NETWORK ERROR: ${err}`);
  }
}

async function testElasticQueries() {
  console.log("🚀 Testing Raw Elasticsearch Queries (simulating Next.js API routes)");
  console.log("===================================================================");
  
  // 1. Map endpoint (Melbourne CBD bounding box)
  // Query from app/api/search/map/route.ts
  await runElasticQuery("Map Bounding Box Search", {
    size: 5,
    query: {
      bool: {
        filter: [
          {
            geo_bounding_box: {
              geo: {
                top_left: { lat: -37.80, lon: 144.95 },
                bottom_right: { lat: -37.82, lon: 144.98 },
              },
            },
          },
        ],
      },
    },
    sort: [{ timestamp: "desc" }],
  });

  // 2. Nearby endpoint (Melbourne CBD, 5km radius)
  // Query from app/api/search/nearby/route.ts
  await runElasticQuery("Nearby Radius Search", {
    size: 5,
    query: {
      bool: {
        filter: [
          {
            geo_distance: {
              distance: "5km",
              geo: { lat: -37.8136, lon: 144.9631 },
            },
          },
        ],
      },
    },
    sort: [
      {
        _geo_distance: {
          geo: { lat: -37.8136, lon: 144.9631 },
          order: "asc",
          unit: "km",
        },
      },
    ],
  });

  // 3. Filter endpoint (Category + Location)
  // Query from app/api/search/filter/route.ts
  await runElasticQuery("Filter Search (Category: birds + Location: Melbourne)", {
    size: 5,
    query: {
      bool: {
        must: [
          {
            match: {
              location_name: {
                query: "Melbourne",
                fuzziness: "AUTO",
              },
            },
          },
        ],
        filter: [
          {
            bool: {
              should: [
                { terms: { dominant_class: ["birds"] } },
                { terms: { tags: ["birds"] } },
              ],
              minimum_should_match: 1,
            },
          },
        ],
      },
    },
    sort: [{ timestamp: "desc" }],
  });

  // 4. Time-based general refresh check (what the polling essentially queries without filters)
  await runElasticQuery("General Auto-Refresh (Most Recent)", {
    size: 10,
    query: { match_all: {} },
    sort: [{ timestamp: "desc" }],
  });

  console.log("\n===================================================================");
  console.log("✨ All queries completed!");
}

testElasticQueries();
