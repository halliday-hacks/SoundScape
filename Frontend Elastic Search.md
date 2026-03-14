Here's the summary:

---

## Elastic Search API — Frontend Guide

### Base routes (all server-side, credentials never reach the client)

| Route                    | Purpose                                 |
| ------------------------ | --------------------------------------- |
| `GET /api/search/map`    | Pins for the current map viewport       |
| `GET /api/search/nearby` | Pins within a radius of the user        |
| `GET /api/search/filter` | Filter by category and/or location name |

---

### `GET /api/search/map`

Returns pins inside a map viewport bounding box.

**Query params:**

```
top_left_lat, top_left_lon, bottom_right_lat, bottom_right_lon
```

**Example:**

```
/api/search/map?top_left_lat=-37.7&top_left_lon=144.9&bottom_right_lat=-37.9&bottom_right_lon=145.1
```

---

### `GET /api/search/nearby`

Returns pins within a radius of a point.

**Query params:**

```
lat, lon, radius   (radius defaults to "5km" if omitted)
```

**Example:**

```
/api/search/nearby?lat=-37.814&lon=144.963&radius=3km
```

---

### `GET /api/search/filter`

Filter by dominant sound class and/or location name text.

**Query params:**

```
category          (e.g. "bird", "traffic", "insect", "wind", "construction", "silence")
location          (free text, e.g. "Fitzroy", "Royal Park")
```

Both are optional — omitting both returns the 20 most recent uploads.

**Example:**

```
/api/search/filter?category=bird&location=Fitzroy
```

---

### Response shape (all three routes)

```ts
{
  hits: [
    {
      upload_id: string,
      title: string,
      dominant_class: string,
      tags: string[],
      geo: { lat: number, lon: number } | null,
      location_name: string | null,
      likes: number,
      listen_count: number,
      timestamp: number,       // Unix ms — use for "X minutes ago"
      biodiversity_score: number | null,
    }
  ]
}
```

---

### Auto-refresh + force refresh pattern

```ts
// Auto-poll every 30 seconds
useEffect(() => {
  const id = setInterval(fetchPins, 30_000);
  return () => clearInterval(id);
}, []);

// Force refresh button — just call the same fetch immediately
<button onClick={fetchPins}>↺ Refresh</button>
```

Both call the same API routes — no extra backend work needed.

---

### Getting audio for a pin

Once the user taps a pin, use the `upload_id` to fetch the Convex storage URL:

```ts
// Convex query
const url = useQuery(api.uploads.getStorageUrl, { storageId });
```

Likes and listen counts are written back via Convex mutations directly — no Elastic write needed from the frontend.

---

### How to search for "Fitzroy"

**1. Call the helper from any component:**

```ts
import { geocodeBest, geocodeAddress } from "@/lib/geocode";

// Single best match — use this for "fly to location" on the map
const loc = await geocodeBest("Fitzroy");
// → { lat: -37.7963, lon: 144.9778, display_name: "Fitzroy, City of Yarra...", boundingbox: [...] }

// All candidates — use this for a suggestion dropdown
const suggestions = await geocodeAddress("Fitzroy");
```

**2. Fly the Leaflet map to the result:**

```ts
if (loc) {
  map.flyTo([loc.lat, loc.lon], 14);
  // or fit the bounding box for a suburb-level zoom:
  // map.fitBounds([[loc.boundingbox[0], loc.boundingbox[2]], [loc.boundingbox[1], loc.boundingbox[3]]]);
}
```

**3. Then search for nearby sounds:**

```ts
if (loc) {
  fetch(`/api/search/nearby?lat=${loc.lat}&lon=${loc.lon}&radius=2km`);
}
```

---

### What was created

| File       | Purpose                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------ |
| route.ts   | Server-side Nominatim proxy — handles User-Agent, caches 60s, biases to Australia, returns top 5 |
| geocode.ts | `geocodeBest(query)` and `geocodeAddress(query)` — call these from components                    |

**Tip:** wrap the search input with a 300ms debounce before calling `geocodeAddress` to stay within Nominatim's 1 req/sec rate limit.

Made changes.
