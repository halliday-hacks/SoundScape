# SoundScape Project Memory

## Project Identity
- **Event:** UNIHACK 2026, March 13–15, 2026 (48-hour hackathon)
- **Tagline:** "Listen to the Earth. Watch it Grow."
- **Core concept:** Real-time environmental audio classification → pixel art biome + social sound map

## Tech Stack (planned)
- Next.js 16 + Convex + Elasticsearch + BetterAuth (Google OAuth) + TF.js (YAMNet + BirdNET) + HTML Canvas
- Art style: Pixel art (Terraria/Stardew Valley aesthetic), 16x16 tiles, 50x25 grid

## Current State (as of March 14, 2026)
### ✅ Built
- Full auth system (email/password, OTP, magic links) — BetterAuth via `@convex-dev/better-auth`
- Convex schema: `classificationEvents`, `uploads`, `userLikes` tables with indexes
- CRUD mutations/queries for uploads and classification events
- Like/unlike functionality with real-time counters
- Dashboard with test data seeding
- Protected routes with auth guards
- 50+ shadcn/ui components
- Email templates (verify, OTP, magic link, reset)

### ❌ Not Yet Built (priority order)
1. **Audio ML pipeline** — TF.js YAMNet (on-device, 6 categories: bird/insect/traffic/construction/wind/silence) + BirdNET species ID
2. **Pixel art canvas engine** — `PixelWorldEngine` class, tile system, sprite animations, particle system
3. **Elasticsearch integration** — indices `soundscape-events` + `soundscape-uploads`, Convex→Elastic sync, API routes
4. **Google OAuth** — BetterAuth needs Google credentials configured
5. **Map/Social discovery** — Leaflet + OpenStreetMap, clustered pins, audio player cards
6. **Upload flow UI** — record/select audio, compress WebM/Opus, upload to Convex storage
7. **Biodiversity score display** — 0-100 score UI

## Key Architecture Decisions
- On-device ML (no server inference) — TF.js runs in browser
- Convex for real-time subscriptions (events, likes, listens)
- Elastic for geo search, aggregations, NL queries (via Gemini)
- One-way sync: Convex → Elastic after every write via `scheduler.runAfter(0, ...)`
- Canvas pixel world is the centerpiece, modern UI wraps it

## Audio Classification → Pixel World Mapping
- Bird > 0.5 → trees grow (species determines shape: Kookaburra=eucalyptus, Magpie=gum, Rosella=flowering)
- Insect > 0.3 → flowers bloom, butterflies
- Traffic > 0.5 → desaturate, cracks, smog overlay
- Construction > 0.5 → dust particles, crumbled dirt
- Wind/Rain > 0.3 → rain pixels, puddles, clouds
- Silence → fog, muted warm palette

## Key Files
- `convex/schema.ts` — DB schema
- `convex/classificationEvents.ts` — classification mutations/queries
- `convex/uploads.ts` — upload mutations/queries
- `app/(auth)/dashboard/` — main dashboard
- `lib/auth-client.tsx` — client auth setup
- `lib/auth-server.ts` — server auth utilities

## Target Prizes
Main Prize, Best Use of Elastic, AI Solutions, Most Creative, Social Impact, Best Design

## Env Vars Needed
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ELASTIC_URL, ELASTIC_API_KEY, GEMINI_API_KEY
(NEXT_PUBLIC_CONVEX_URL, CONVEX_DEPLOY_KEY already set)
