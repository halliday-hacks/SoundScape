# Hackathon Starter

Convex + Better Auth + Next.js starter with the SoundSoil feature — converts audio into pixel-art GIFs or Veo-generated videos.

## Stack

- **Next.js 16** — App Router, React 19
- **Convex** — real-time database, serverless functions
- **Better Auth** — authentication via `@convex-dev/better-auth`
- **Tailwind CSS v4** + **shadcn/ui** — styling
- **Anthropic Claude** — pixel-art GIF generation (claude-haiku-4-5)
- **Google Gemini + Veo 2.0** — prompt writing + video generation
- **YAMNet** (TF.js) — audio classification

---

## Prerequisites

- [Bun](https://bun.sh) — package manager and script runner
- [ffmpeg](https://ffmpeg.org) — audio conversion (for non-WAV files)
- A [Convex](https://convex.dev) account
- API keys: `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`

---

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url>
cd hackathon-starter
bun install
```

### 2. Set up Convex

```bash
npx convex dev --once
```

This will prompt you to log in and create a new Convex project. It writes your `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` to `.env.local` automatically.

### 3. Set environment variables

Create a `.env.local` in the project root:

```env
# Convex (written automatically by `npx convex dev --once`)
CONVEX_DEPLOYMENT=...
NEXT_PUBLIC_CONVEX_URL=...

# Anthropic — used by SoundSoil GIF mode
ANTHROPIC_API_KEY=sk-ant-...

# Google Gemini — used by SoundSoil Veo mode
GEMINI_API_KEY=AIza...
```

### 4. Set up the YAMNet model locally

YAMNet is a TF.js audio classifier that runs server-side. The model files (~14 MB) are **not committed to git** and must be downloaded separately.

Run the download script:

```bash
bun scripts/download-yamnet.ts
```

> If that script doesn't exist yet, download manually — see [Manual YAMNet setup](#manual-yamnet-setup) below.

The model files land in `public/yamnet-model/`:

```
public/yamnet-model/
  model.json
  group1-shard1of4.bin
  group1-shard2of4.bin
  group1-shard3of4.bin
  group1-shard4of4.bin
```

The API route loads the model from `public/yamnet-model/model.json` at runtime using a `file://` URL. No environment variable needed for local dev.

#### Manual YAMNet setup

If you prefer to download manually, grab the files from the TensorFlow Hub:

```bash
mkdir -p public/yamnet-model

# model graph
curl -L "https://storage.googleapis.com/tfhub-tfjs-modules/google/tfjs-model/yamnet/tfjs/1/model.json" \
  -o public/yamnet-model/model.json

# weight shards (check model.json for the exact shard names — they may differ)
curl -L "https://storage.googleapis.com/tfhub-tfjs-modules/google/tfjs-model/yamnet/tfjs/1/group1-shard1of4.bin" \
  -o public/yamnet-model/group1-shard1of4.bin

curl -L "https://storage.googleapis.com/tfhub-tfjs-modules/google/tfjs-model/yamnet/tfjs/1/group1-shard2of4.bin" \
  -o public/yamnet-model/group1-shard2of4.bin

curl -L "https://storage.googleapis.com/tfhub-tfjs-modules/google/tfjs-model/yamnet/tfjs/1/group1-shard3of4.bin" \
  -o public/yamnet-model/group1-shard3of4.bin

curl -L "https://storage.googleapis.com/tfhub-tfjs-modules/google/tfjs-model/yamnet/tfjs/1/group1-shard4of4.bin" \
  -o public/yamnet-model/group1-shard4of4.bin
```

#### Verify the model works

```bash
# Requires a WAV file — convert with ffmpeg if needed:
# ffmpeg -i input.mp3 -ar 16000 -ac 1 output.wav

bun scripts/test-yamnet.ts path/to/audio.wav
```

Expected output:

```json
{
  "primary_label": "Bird",
  "primary_confidence": 0.92,
  "duration_s": 3.5,
  "top_labels": [
    { "label": "Bird", "score": 0.92 },
    { "label": "Animal", "score": 0.87 },
    ...
  ],
  ...
}
```

### 5. Run the app

```bash
bun run dev
```

This starts the Next.js frontend and the Convex backend concurrently. Open [http://localhost:3000/soundsoil](http://localhost:3000/soundsoil).

---

## SoundSoil

SoundSoil converts audio into visual art via two modes.

### GIF mode (fast, ~10–30s)

```
Audio → YAMNet → Claude Haiku (draws pixel-art frames) → GIF
```

Uses `ANTHROPIC_API_KEY`. No extra setup beyond the YAMNet model.

### Veo mode (slow, ~1–3 min)

```
Audio → YAMNet → Gemini Flash (writes prompt) → Veo 2.0 (generates 8s MP4)
```

Uses `GEMINI_API_KEY`. Output is a silent 720p 16:9 pixel-art video — no audio is generated.

Both modes stream progress back to the frontend over SSE so you see live step updates.

---

## Convex: YAMNet in production

When deployed, Convex actions need the model served over HTTPS (not `file://`). Set the `YAMNET_MODEL_URL` env var in the Convex dashboard pointing to where `model.json` is hosted — for example, your Vercel deployment's public URL:

```bash
npx convex env set YAMNET_MODEL_URL https://your-app.vercel.app/yamnet-model/model.json
```

Because the model files are in `public/yamnet-model/`, they are automatically served as static assets by Vercel/Next.js at that path.

---

## Project Structure

```
app/
  soundsoil/page.tsx      → SoundSoil UI (mode toggle, upload, progress, result)
  api/soundsoil/route.ts  → SSE pipeline: YAMNet → Claude/GIF or Gemini/Veo
components/               → React UI components (shadcn/ui)
convex/                   → Convex backend (schema, functions, auth, http)
  analyzeAudio.ts         → Internal action: run YAMNet on a Convex-stored file
  uploads.ts              → Upload mutations/queries
  schema.ts               → Database schema
lib/
  yamnet-analyzer.ts      → TF.js YAMNet audio classifier
scripts/
  test-yamnet.ts          → WAV → YAMNet → JSON (CLI)
  generate-pixel-art.ts   → WAV → YAMNet → Claude → GIF (offline CLI)
public/
  yamnet-model/           → TF.js model files (gitignored, download separately)
```

---

## Dev Commands

```bash
bun run dev      # Start frontend + Convex backend
bun run lint     # ESLint + TypeScript checks
```
