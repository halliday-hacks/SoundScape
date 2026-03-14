# Project: Hackathon Starter

Convex + Better Auth + Next.js hackathon starter app.

## Stack

- **Framework:** Next.js 16 (App Router, React 19)
- **Backend:** Convex (real-time database, serverless functions)
- **Auth:** Better Auth via `@convex-dev/better-auth`
- **Styling:** Tailwind CSS v4, shadcn/ui
- **Language:** TypeScript (strict mode)
- **AI:** Anthropic Claude (pixel-art GIF generation), Google Gemini + Veo 2.0 (video generation)

## Project Structure

```
app/                      → Next.js app router pages and layouts
  soundsoil/page.tsx      → SoundSoil UI (mode toggle, upload, progress, result)
  api/soundsoil/route.ts  → SSE pipeline: YAMNet → Claude/GIF or Gemini/Veo
components/               → React UI components (shadcn/ui)
convex/                   → Convex backend (schema, functions, auth, http)
lib/                      → Shared utilities and client config
  yamnet-analyzer.ts      → TF.js YAMNet audio classifier
scripts/                  → CLI tools
  test-yamnet.ts          → WAV → YAMNet → JSON (used by API route via execFileSync)
  generate-pixel-art.ts   → WAV → YAMNet → Claude → GIF (offline)
public/                   → Static assets
```

## SoundSoil

SoundSoil is a feature that converts audio files into visual art using a two-mode pipeline.

### Pipeline

```
Audio upload → YAMNet (TF.js audio classifier) → Claude or Veo
```

**GIF mode** (fast, ~10–30s):

- Step 1 — YAMNet classifies the audio (top-5 labels + confidence)
- Step 2 — Claude Haiku generates a pixel-art `drawFrame()` function body for node-canvas
- Step 3 — GIF encoder renders 60 frames at 12fps → returns `data:image/gif;base64,...`

**Veo mode** (slow, ~1–3 min):

- Step 1 — YAMNet classifies the audio
- Step 2 — Gemini Flash (`gemini-2.5-flash`) writes a cinematic pixel-art Veo prompt from the labels
- Step 3 — Veo 2.0 (`veo-2.0-generate-001`) generates a silent 8s 720p 16:9 MP4 → returns `data:video/mp4;base64,...`

The frontend (`app/soundsoil/page.tsx`) streams SSE progress events and renders either `<img>` (GIF) or `<video>` (MP4).

### Veo Prompt Rules

The Gemini prompt-builder (`buildVeoPrompt`) enforces:

- Style: retro pixel art, 16-bit, chunky pixels, limited palette (8–16 colours), scanlines
- No audio cues — do NOT mention sound, music, dialogue, or any auditory elements
- No people or faces
- Static or slow-pan camera only
- Under 80 words

### Environment Variables

| Variable            | Used by                                                |
| ------------------- | ------------------------------------------------------ |
| `ANTHROPIC_API_KEY` | Claude (GIF mode, step 2)                              |
| `GEMINI_API_KEY`    | Gemini Flash (Veo prompt) + Veo 2.0 (video generation) |

### API Route

`POST /api/soundsoil` — public (whitelisted in `proxy.ts`)

- Input: `multipart/form-data` with `audio` (File) and `mode` (`"gif"` or `"veo"`)
- Output: `text/event-stream` SSE
  - `progress` → `{ step: 1|2|3, label: string, detail?: string, frameProgress?: number }`
  - `done` → `{ gif: "data:image/gif;base64,..." }` or `{ video: "data:video/mp4;base64,..." }`
  - `error` → `{ message: string }`

### Available Gemini Models

Use `gemini-2.5-flash` for text generation (not versioned preview aliases — they expire).
Use `veo-2.0-generate-001` for video generation.

## Convex Guidelines

### Function Syntax

Always use the new function syntax with argument and return validators:

```typescript
import { query } from "./_generated/server";
import { v } from "convex/values";

export const f = query({
  args: { name: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    return "Hello " + args.name;
  },
});
```

If a function doesn't return anything, use `returns: v.null()`.

### Public vs Internal Functions

- `query`, `mutation`, `action` → public API, exposed to the internet
- `internalQuery`, `internalMutation`, `internalAction` → private, only callable by other Convex functions
- Do NOT use public registrations for sensitive internal logic

### Function References

- Use `api.file.functionName` for public functions
- Use `internal.file.functionName` for internal functions
- Convex uses file-based routing: `convex/todos.ts` → `api.todos.functionName`

### Queries

- Do NOT use `.filter()` — define an index and use `.withIndex()` instead
- Use `.order("asc")` or `.order("desc")` for ordering (defaults to ascending `_creationTime`)
- Use `.unique()` for single document retrieval
- Convex queries do NOT support `.delete()` — collect results and call `ctx.db.delete(row._id)` on each

### Mutations

- `ctx.db.patch(id, fields)` → shallow merge update
- `ctx.db.replace(id, fields)` → full document replacement

### Actions

- Add `"use node";` at the top of files using Node.js built-in modules
- Actions do NOT have `ctx.db` access — use `ctx.runQuery`/`ctx.runMutation` instead
- Only call an action from another action if crossing runtimes (V8 ↔ Node)

### Schema

- Define schema in `convex/schema.ts`
- System fields `_id` and `_creationTime` are auto-added
- Include all index fields in index names (e.g., `"by_field1_and_field2"`)
- Index fields must be queried in definition order

### Validators

- `v.bigint()` is deprecated — use `v.int64()`
- Use `v.record(keys, values)` for records; `v.map()` and `v.set()` are not supported
- Use `v.null()` for null return values
- JavaScript `undefined` is not a valid Convex value — use `null`

### TypeScript

- Use `Id<"tableName">` for document ID types (from `./_generated/dataModel`)
- Use `Doc<"tableName">` for full document types
- Be strict with ID types — prefer `Id<"users">` over `string`
- Add `@types/node` when using Node.js built-in modules

### HTTP Endpoints

Define in `convex/http.ts`:

```typescript
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

const http = httpRouter();
http.route({
  path: "/api/route",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const body = await req.bytes();
    return new Response(body, { status: 200 });
  }),
});
export default http;
```

### Scheduling & Crons

- Use `crons.interval` or `crons.cron` only (not `.hourly`, `.daily`, `.weekly`)
- Pass function references, not functions directly
- Define in `convex/crons.ts`, export `crons` as default

### File Storage

- Use `ctx.storage.getUrl()` for signed URLs (returns `null` if file doesn't exist)
- Query `_storage` system table for metadata (not deprecated `ctx.storage.getMetadata`)
- Store/retrieve items as `Blob` objects

## Dev Commands

```bash
bun run dev          # Start frontend + backend concurrently
bun run lint         # ESLint + TypeScript checks
```

## Installed Agent Skills

Skills live in `.agents/skills/` and are symlinked into each agent's config directory
(e.g., `.claude/skills/`, `.cursor/rules/`). All agents on this project share the same skills.

| Skill                                 | Source                   | Purpose                                                        |
| ------------------------------------- | ------------------------ | -------------------------------------------------------------- |
| `convex`                              | waynesutton/convexskills | Convex development patterns, schema design, queries, mutations |
| `better-auth-best-practices`          | better-auth/skills       | Better Auth integration patterns for TypeScript apps           |
| `better-auth-security-best-practices` | better-auth/skills       | Rate limiting, CSRF, session security, OAuth security          |
| `shadcn-ui`                           | jezweb/claude-skills     | shadcn/ui component patterns and Tailwind v4 integration       |
| `vercel-react-best-practices`         | vercel-labs/agent-skills | React/Next.js performance optimization from Vercel Engineering |

To add more skills: `npx skills find <query>` then `npx skills add <package> -y`

## Conventions

- Keep Convex functions focused — one concern per function
- Prefer indexes over filters for all database queries
- Minimize action-to-query/mutation calls (each is a separate transaction)
- Use `ctx.scheduler.runAfter(0, ...)` for fire-and-forget background work
