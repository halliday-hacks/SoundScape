# Social Endpoints — Frontend Guide v3

> **Restored from v1 + fixes from live testing (March 15, 2026).**
> BetterAuth auto-manages the `username` field and index — no manual schema changes needed.

---

## `GET /api/uploads/recent`

**Purpose:** Global feed of newest uploads

**Query params:**

- `limit` — number of results (default 20, max 50)

```ts
const res = await fetch("/api/uploads/recent?limit=10");
const { uploads } = await res.json();
```

**Response:**

```ts
{
  uploads: Array<{
    id: string;
    userId: string;
    title: string;
    description: string | null;
    storageId: string | null; // guard before calling getStorageUrl
    lat: number | null;
    lon: number | null;
    locationLabel: string | null;
    dominantClass: string | null; // "birds" | "traffic" | "insects" | "wind" | "construction" | "silence"
    tags: string[];
    likeCount: number;
    listenCount: number;
    durationSeconds: number | null;
    biodiversityScore: number | null;
    createdAt: number; // Unix ms
  }>;
}
```

---

## `GET /api/users/leaderboard`

**Purpose:** Community leaderboard — users ranked by score (uploadCount + totalLikes)

```ts
const res = await fetch("/api/users/leaderboard?limit=10");
const { leaderboard } = await res.json();
```

**Response:**

```ts
{
  leaderboard: Array<{
    id: string;
    name: string; // Full name e.g. "Rasheed Mohammed"
    username: string | null; // BetterAuth-managed — may be null if user never set one
    image: string | null; // Google profile picture URL
    uploadCount: number;
    totalLikes: number;
    totalListens: number;
    score: number; // uploadCount + totalLikes
  }>;
}
```

---

## `GET /api/users/:username`

**Purpose:** User profile page data — looks up by BetterAuth username

```ts
const res = await fetch("/api/users/johndoe");

if (!res.ok) {
  // Handle 404 — user not found
  const { error } = await res.json(); // { error: "User not found" }
  return;
}

const { user, stats, uploads } = await res.json();
```

**Response:**

```ts
{
  user: {
    id: string
    name: string
    username: string
    image: string | null
    createdAt: number
  },
  stats: {
    uploadCount: number
    totalLikes: number
    totalListens: number
  },
  uploads: Array<{
    id: string
    title: string
    description: string | null
    storageId: string | null
    lat: number | null
    lon: number | null
    locationLabel: string | null
    dominantClass: string | null
    tags: string[]
    likeCount: number
    listenCount: number
    durationSeconds: number | null
    createdAt: number
  }>
}
```

**Error responses:**

```ts
{ "error": "User not found" }   // 404 — username doesn't exist
{ "error": "..." }              // 500 — server error
```

---

## React Hooks

```tsx
import { useState, useEffect } from "react";

function useLeaderboard(limit = 10) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/users/leaderboard?limit=${limit}`)
      .then((res) => res.json())
      .then((json) => setData(json.leaderboard))
      .finally(() => setLoading(false));
  }, [limit]);

  return { leaderboard: data, loading };
}

function useUserProfile(username: string) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!username) return;
    fetch(`/api/users/${username}`)
      .then(async (res) => {
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        const json = await res.json();
        setData(json);
      })
      .finally(() => setLoading(false));
  }, [username]);

  return { profile: data, loading, notFound };
}
```

---

## Audio Playback URL

`storageId` can be null on some records — always guard before calling Convex.

```ts
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const audioUrl = useQuery(
  api.uploads.getStorageUrl,
  storageId ? { storageId } : "skip"
);

<audio src={audioUrl ?? undefined} controls />
```

---

## Likes and Listen Counts — write via Convex, not REST

These are real-time and must go through Convex mutations directly:

```ts
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const like = useMutation(api.uploads.like);
const incrementListenCount = useMutation(api.uploads.incrementListenCount);

// On like button press
await like({ uploadId: upload.id });

// When audio starts playing
await incrementListenCount({ uploadId: upload.id });
```

Convex syncs counts back to Elastic automatically — no manual REST call needed.

---

## Notes

- `dominantClass` is always `"birds"` (plural) for real uploads — seed data may have `"bird"` (singular), filter or normalise on display
- `biodiversityScore` is `null` for short clips (< ~5s) — the ML pipeline needs enough audio to score
- `username` is BetterAuth-managed — populated after first Google login, but could be null for very old records
