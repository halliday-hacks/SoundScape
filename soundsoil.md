SoundSoil - Complete Project Context (v5 - FINAL)

Purpose of this document: This is a comprehensive context dump for the SoundSoil hackathon project. Paste this into a new conversation to give full context on the project vision, architecture, technical decisions, prize strategy, and build plan. Everything needed to help build, debug, design, or pitch SoundSoil is here.

Tech Stack: Next.js (Vercel) + Convex (real-time backend + file storage) + Elasticsearch (search/geo/analytics) + BetterAuth (Google OAuth) + TensorFlow.js (on-device ML) + HTML Canvas (pixel art rendering)

ART STYLE: Pixel art. Think Terraria / Stardew Valley / classic Nintendo. The landscape is a side-scrolling pixelated biome that grows, degrades, and transforms based on real-time audio classification. NOT watercolour, NOT 3D, NOT minimalist web design - it's a retro game world.

Table of Contents

Project Overview

Hackathon Context (UNIHACK 2026)

Problem Statement

Product Vision & Core Concept

Feature Specification (48-Hour MVP)

Social Audio Discovery

Technical Architecture

Convex Schema & Functions (Deep Dive)

Elastic Integration (Deep Dive)

BetterAuth Setup

Pixel Art Visualization (Deep Dive)

Audio ML Pipeline (Deep Dive)

Design Principles

Prize Alignment Strategy

48-Hour Build Plan

Risk Register & Mitigations

Pitch Video Strategy

Lessons from UNIHACK 2025 Winners

Success Metrics

Future Vision

1. Project Overview

Name: SoundSoil

Tagline: Listen to the Earth. Watch it Grow.

Event: UNIHACK 2026 - March 13-15, 2026 (48-hour hackathon)

Team size: 4-6 people, full-stack balanced

One-liner: SoundSoil is a real-time environmental soundscape platform that turns neighbourhood audio into a living, pixelated game world - and lets communities explore and share the sounds of any place on earth.

What it does: Users place their device outdoors. The app continuously classifies ambient audio identifying bird species, insect activity, traffic density, construction noise, and weather sounds using on-device machine learning. This data feeds a dynamic pixel art landscape rendered like a Terraria/Stardew Valley biome: birdsong grows pixelated trees and spawns animated birds, insects bloom flowers and butterflies, traffic turns the world grey and cracked, rain makes pixel puddles. All data syncs in real-time via Convex and is indexed in Elasticsearch for powerful search and geo-queries. Community members upload acoustic recordings to a world map (SoundCloud meets Google Maps for the planet).

Target prizes (ranked):

Main Prize ($5,000 + gear)

Best Use of Elastic Technology ($100 Prezzee per person)

AI Solutions Prize (Quantium mentoring + swag)

Most Creative Idea

Social Impact Prize

Best Design

2. Hackathon Context: UNIHACK 2026

What: Australia's biggest student hackathon - 500+ students, hybrid

When: Friday March 13 6:30PM - Sunday March 15 5:00PM AEDT

Theme: No theme - build whatever you want

Submission: DevPost with video, screenshots, GitHub link, live demo preferred

Judging: Panel reviews March 16-20, winners announced March 23

Judging Criteria (Main Prize)

Polish, Design, and Execution - Does it look good? Intuitive, aesthetic, accessible? Does it work?

Technical Difficulty - Technically interesting? Not just a pretty frontend on an API?

Originality and Creativity - Unique? New problem or new take?

Wow Factor - Does it spark joy? Would you show it to friends?

Category Prizes

EU Shared Future Prize - Secure & stable future, spirit of cooperation

First Timers Prize (Atlassian)

Best Use of Elastic Technology

AI Solutions Prize (Quantium)

Best Design - Most usable and best looking UI

Most Creative Idea

Social Impact Prize

Most Fun Idea

Most Entertaining Pitch

People's Choice Award

Submission Requirements
DevPost writeup + third-party/AI tool list + public GitHub + screenshots + video (max 3 min) + live demo preferred

3. Problem Statement

The Invisible Environmental Crisis
Urban biodiversity loss is accelerating across Australia, but it's invisible. No accessible, real-time way for citizens to understand ecological health of their neighbourhood.

Why Sound?
Soundscapes are one of the most reliable indicators of ecosystem health. Rich = layered birdsong, insect hums, rustling. Degraded = traffic, machinery, silence. Sound is continuous, non-invasive, 24/7.

The Gap

No consumer tool turns environmental audio into ecological insight

Existing acoustic tools are expensive, specialist, scientist-only

No way for citizens to measure, track, or share local environmental data

No social platform for place-based audio discovery

4. Product Vision & Core Concept

Core Experience Loop

LISTEN - Place device outdoors. Audio capture begins.

CLASSIFY - On-device ML identifies: bird species, insects, traffic, rain, machinery, wind.

GROW - A pixel art landscape responds live. Birdsong = trees grow. Insects = flowers bloom. Traffic = world goes grey.

SEARCH - Elastic indexes everything. "When did I last hear a kookaburra?"

SHARE - Upload recordings to the world map.

DISCOVER - Browse, tap pins, listen to what places sound like.

The Vibe
The pixel art world should feel like a cozy nature game you'd play on a Game Boy - charming, warm, satisfying to watch grow. Think Stardew Valley's aesthetic warmth crossed with Terraria's biome-transformation mechanic. The social map is explorative and curiosity-driven. There's a delightful contrast between serious environmental monitoring and a cute pixelated world that makes it approachable and shareable.

Target Users

User Type

Description

Motivation

Nature Enthusiasts

Birdwatchers, gardeners, eco-conscious

Track biodiversity, share

Urban Explorers

Curious people

Discover city through sounds

Students

Environmental science

Affordable acoustic data

Councils

Urban planners

Neighbourhood-level monitoring

Community Groups

Conservation, Landcare

Advocate with evidence

5. Feature Specification (48-Hour MVP)

P0 - Must Have

5.1 Audio Capture & Classification Engine: On-device, NOT cloud API. YAMNet (TF.js) → 6-category vector → BirdNET for species.

5.2 Pixel Art Landscape Visualization: A living pixel art biome (Terraria/Stardew style) that transforms based on classification.

Sound

Pixel Art Effect

Birdsong

Pixel trees grow tile-by-tile, animated birds perch and fly

Insects

Pixel flowers bloom, butterflies flutter, grass waves

Wind/Rain

Pixel rain falls, puddles form, clouds scroll, grass bends

Traffic

Tiles desaturate to grey, cracks appear, smog pixels drift

Construction

Dust particles, crumbling tiles, brown palette

Silence

Gentle pixel fog, muted but peaceful

5.3 Convex Real-Time Backend: Real-time subscriptions, CRUD, file storage, auth.

5.4 Elastic Search & Analytics: Geo-radius, full-text search, aggregations, NL query parsing.

5.5 BetterAuth (Google OAuth): One-click Google login. Anonymous browsing allowed.

5.6 Biodiversity Score: 0-100 from: species diversity, Shannon index, noise pollution ratio, temporal consistency.

5.7 Social Audio Discovery Map: SoundCloud meets Google Maps. See Section 6.

P1 - Should Have

NL temporal search ("When did I last hear magpies?")

Map heatmap overlay

Neighbourhood leaderboard

P2 - Cut without guilt

Push notifications, comments, user profiles, shareable landscape screenshots

6. Social Audio Discovery

Core Concept - "SoundCloud meets Google Maps"
Upload geo-tagged recordings to a world map. Anyone browses, taps a pin, listens.

Map UI

Leaflet + OpenStreetMap with clustered pins

Search bar: Location, species, or category

Filter pills: Birds, Rain, City, Wind, Insects

Date filter: Today, this week, this month

Pin tap → Sound card:

Audio player with waveform

Uploader name + Google profile pic

Timestamp, duration

AI classification tags

Biodiversity score

Like button + listen count (real-time via Convex)

"View landscape" → renders the pixel art scene for that recording

Upload Flow

Select clips (10-60s) → compress WebM/Opus → Convex file storage

Convex mutation: create upload doc with geo, classification, species, metadata

Convex action: sync to Elastic

New pin appears on map instantly (Convex subscription)

Discovery Flow

Browse map → Elastic geo-bounding-box query

Pins rendered → tap → sound card → audio from Convex storage

Like → Convex mutation (real-time update)

Interactions

Listen, Like (real-time), Share (deep-linkable URLs), Filter (Elastic)

7. Technical Architecture

Why This Split

Convex: Real-time subscriptions, CRUD, file storage, auth, atomic mutations

Elastic: Geo-spatial queries, full-text search, aggregations - wins the Elastic prize

One-way sync: Convex → Elastic after every write via scheduled actions

Tech Stack

Layer

Technology

Rationale

Frontend

Next.js + TypeScript

Vercel deploy, React

Real-Time Backend

Convex

Subscriptions, file storage, auth

Search/Geo

Elasticsearch (Elastic Cloud)

Geo-queries, search, aggregations

Auth

Better Auth (Google OAuth)

Simple, Convex adapter

Rendering

HTML Canvas (pixel art)

Tile-based rendering, sprite sheets, retro game engine

Audio ML

TensorFlow.js (YAMNet) + BirdNET-Lite

On-device inference

Maps

Leaflet + OpenStreetMap

Free

AI

Gemini API

NL → Elastic queries

Hosting

Vercel

Free tier

Data Flows

Monitoring: Mic → YAMNet → 6-category vector → (BirdNET if bird) → Pixel engine (local) + Convex mutation + Elastic sync

Upload: Select clip → Convex storage → Convex mutation → Elastic sync → pin on map (real-time)

Discovery: Browse map → Elastic geo query → pins tap → Convex for real-time data → audio play → like via Convex

8. Convex Schema & Functions (Deep Dive)

Schema (convex/schema.ts)

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
events: defineTable({
sessionId: v.string(),
userId: v.optional(v.id("users")),
timestamp: v.number(),
geo: v.object({ lat: v.number(), lng: v.number() }),
classification: v.object({
birds: v.number(),
insects: v.number(),
traffic: v.number(),
wind: v.number(),
construction: v.number(),
silence: v.number(),
}),
dominantClass: v.string(),
speciesCommon: v.optional(v.string()),
confidence: v.number(),
biodiversityScore: v.number(),
})
.index("by_session", ["sessionId"])
.index("by_user", ["userId"])
.index("by_timestamp", ["timestamp"]),

uploads: defineTable({
userId: v.id("users"),
title: v.string(),
description: v.optional(v.string()),
locationName: v.string(),
timestamp: v.number(),
duration: v.number(),
geo: v.object({ lat: v.number(), lng: v.number() }),
audioId: v.id("\_storage"),
classification: v.object({
birds: v.number(),
insects: v.number(),
traffic: v.number(),
wind: v.number(),
construction: v.number(),
silence: v.number(),
}),
dominantClass: v.string(),
speciesDetected: v.array(v.string()),
biodiversityScore: v.number(),
tags: v.array(v.string()),
likes: v.number(),
listenCount: v.number(),
elasticSynced: v.boolean(),
})
.index("by_user", ["userId"])
.index("by_timestamp", ["timestamp"])
.index("by_dominant_class", ["dominantClass"])
.index("by_elastic_sync", ["elasticSynced"]),

users: defineTable({
name: v.string(),
email: v.string(),
image: v.optional(v.string()),
}).index("by_email", ["email"]),
});

Key Functions - Elastic Sync (convex/elastic.ts)

import { action } from "./\_generated/server";
import { v } from "convex/values";

export const syncClassificationEvent = action({
args: { id: v.id("events") },
handler: async (ctx, args) => {
// Logic to sync Convex events to Elasticsearch
// fetch(`${process.env.ELASTIC_URL}/soundsoil-events/_doc/${args.id}`, ... )
}
});

export const syncUploadEvent = action({
args: { id: v.id("uploads") },
handler: async (ctx, args) => {
// Logic to sync Convex uploads to Elasticsearch
// fetch(`${process.env.ELASTIC_URL}/soundsoil-uploads/_doc/${args.id}`, ... )
}
});

9. Elastic Integration

Two Indices

soundsoil-events: (timestamp) (date), (geo) (geo_point), (session_id) (keyword), (classification) (floats), (dominant_class) (keyword), (species_common) (text), (confidence) (float), (biodiversity_score) (integer)

soundsoil-uploads: (upload_id) (keyword), (username) (keyword), (title) (text), (description) (text), (timestamp) (date), (geo) (geo_point), (location_name) (text), (dominant_class) (keyword), (species_detected) (keyword[]), (biodiversity_score) (integer), (tags) (keyword[]), (likes) (integer), (listen_count) (integer)

Key Queries

Geo-bounding-box for map viewport

Geo-distance for "near me" searches

Match on species_detected for species search

Date histogram for bird activity by hour

Geohash grid + avg for biodiversity by area

All through Next.js API routes (never expose credentials to client)

NL → Elastic via Gemini
System prompt tells Gemini the two indices and their fields; returns only valid JSON query.

10. Better Auth Setup

Google OAuth with Convex adapter. useSession() in frontend. Anonymous browsing allowed.

Env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXT_PUBLIC_CONVEX_URL, CONVEX_DEPLOY_KEY, ELASTIC_URL, ELASTIC_API_KEY, NEXT_PUBLIC_APP_URL, GEMINI_API_KEY

11. Pixel Art Visualization (Deep Dive)

The Vision
The landscape is a side-scrolling pixel art biome - like looking at a cross-section of the earth in Terraria or a Stardew Valley farm. The world is built on a tile grid. Each tile can be: dirt, grass, stone, water, flower, tree trunk, leaves, sky, cloud, etc. As audio classification changes, tiles transform - grass grows on dirt, trees sprout tile-by-tile, flowers bloom one pixel at a time. Traffic turns green tiles grey. Rain pixels fall from cloud tiles.

Art Style References

Terraria: Side-view tile-based world that transforms biomes. Corruption spreading vs hallow growing.

Stardew Valley: Warm, cozy pixel art with gentle animations. Seasonal changes.

Celeste: Clean, expressive pixel art with atmospheric effects.

Superbrothers: Sword & Sworcery: Moody, atmospheric pixel landscapes.

Technical Approach

Tile Grid System

// lib/pixel-engine/constants.ts
export const TILE_SIZE = 16;
export const GRID_WIDTH = 50;
export const GRID_HEIGHT = 25;
export const PIXEL_SCALE = 2; // Render at 2x for crispy pixels

export const CANVAS_WIDTH = GRID_WIDTH _ TILE_SIZE _ PIXEL_SCALE; // 1600px
export const CANVAS_HEIGHT = GRID_HEIGHT _ TILE_SIZE _ PIXEL_SCALE; // 800px

Tile Types

enum TileType {
SKY = 0, CLOUD = 1, SUN = 2, MOON = 3,
LEAVES_DENSE = 10, LEAVES_SPARSE = 11, TREE_TRUNK = 12, BRANCH = 13,
FLOWER_RED = 20, FLOWER_YELLOW = 21, FLOWER_PURPLE = 22, GRASS_TALL = 23, GRASS_SHORT = 24, BUSH = 25,
DIRT = 30, GRASS_TOP = 31, STONE = 32, CRACKED_DIRT = 33, WATER = 34, PUDDLE = 35, SAND = 36,
GREY_DIRT = 37, GREY_GRASS = 38,
SMOG = 40, DUST = 41, RAIN = 42, FOG = 43
}

Biome Generation - How Classification Maps to Tiles

Base Terrain: Ground line is at row 13. Hills are created by raising grass line 1-3 rows.

Birdsong → Trees Grow: Spawns TREE_TRUNK, grows, branches, leaves. Animated bird sprite perches on branch.

Insects → Flowers Bloom: FLOWER_RED/YELLOW/PURPLE bloom. Butterfly sprites flutter. If bio score > 70, fireflies at night.

Traffic → Erosion & Grey-out: Green tiles convert to GREY_GRASS → GREY_DIRT → CRACKED_DIRT. Smog overlays appear. Erosion is slow to build and heal.

Construction → Dust & Damage: Dust particles rise. Trees shake. Brown palette overlay.

Wind/Rain → Weather: Clouds scroll, rain particles fall, puddles form. Trees/grass sway.

Silence → Pixel Fog: Fog tiles appear. Calm, zen state.

React Integration & CSS (Crispy Pixels)

// components/pixel-world/PixelCanvas.tsx
<canvas
ref={canvasRef}
width={CANVAS_WIDTH}
height={CANVAS_HEIGHT}
className="w-full h-auto rounded-xl border-2 border-stone-800"
style={{
    imageRendering: "pixelated", // CRITICAL: keeps pixels crispy on scale
    background: "#000",
  }}
/>

canvas {
image-rendering: pixelated;
image-rendering: -moz-crisp-edges;
image-rendering: crisp-edges;
}

12. Audio ML Pipeline

Pipeline
Mic Web Audio API → YAMNet Spectrogram (128 bands, 96 frames) → Classification Event → Sync to UI & Backend

Category Mapping

const CATEGORY_MAP: Record<string, string[]> = {
"Bird": ["Bird vocalization", "Chirp", "Tweet", "Crow", "Magpie", "Kookaburra"],
"Insect": ["Insect", "Bee", "Buzz", "Cricket", "Cicada"],
"Vehicle": ["Car", "Engine", "Traffic", "Motorcycle", "Truck", "Siren"],
"Construction": ["Jackhammer", "Drill", "Hammer", "Sawing", "Power tool"],
"Wind": ["Wind", "Rain", "Thunder", "Storm", "Rustling leaves", "Water"],
"Silence": ["Silence"]
};

BirdNET-Lite: Bird species ID (Australian species included). Triggered when bird > 0.5. Species determines tree sprite type.

13. Design Principles

Pixel Art Visual: 16x16 tile grid, warm/earthy palettes that shift, crispy pixels, gentle animations.

UI Design: Clean, modern UI outside the pixel canvas. The contrast between retro pixel world and clean modern UI is intentional.

Sound Design: Ambient audio filtered. UI sounds are 8-bit style chiptune sounds.

Accessibility: Screen reader descriptions of world state, colour-blind safe palettes, keyboard navigation, auto-generated alt text.

14. Prize Alignment Strategy

Prize

How SoundSoil Wins

Demo Moment

Main Prize

On-device ML + pixel art game engine + Convex real-time + Elastic search + social map = deep, multi-layered tech

Pixel world growing from live birdsong

Best Use of Elastic

Geo, search, aggregations - all critical

NL query → map results

AI Solutions

On-device ML + species ID + NL search + auto-tagging

Real-time classification

Social Impact

Democratises environmental monitoring

Map showing biodiversity gaps

Most Creative

"SoundCloud for the planet" as a pixel art game

Side-by-side biomes

Best Design

Pixel art is MORE distinctive than 99% of hackathon UIS

The sheer charm

Most Fun

It's literally a game world. People will play with it

Watching trees grow

People's Choice

Pixel art = instant emotional reaction + "what does my street sound like?"

Shareable, delightful

15. 48-Hour Build Plan

Role

People

Owns

Audio ML

1-2

TF.js pipeline, classification, spectrograms

Pixel Art/Frontend

1-2

Canvas engine, tile system, sprites, animations, palettes

Backend (Convex + Elastic)

1

Schema, mutations, actions, Elastic sync, API routes

Map/Social/Auth / Pitch

1

Map UI, sound cards, upload, BetterAuth, video, DevPost

Friday Night: Scaffold everything. YAMNet in browser. Canvas rendering basic sky + ground + one tree. Convex schema. Elastic indices. Better Auth.

Saturday: Full pipeline. Classification → pixel world responds. Convex syncing. Map with pins. Sound cards. Upload flow.

Saturday Night - Sunday AM: Polish. Colour palettes. Weather. Sprites. Particles. Filters. NL search. Accessibility. Sound design.

Sunday PM: 3-minute pitch video. DevPost. Seed map. Ship.

16. Risk Register & Mitigations

Risk

Mitigation

Fallback

YAMNet too heavy

Test Friday

Smaller model or backend

Pixel art takes too long

Start with solid-colour tiles, add detail later

Coloured rectangles ARE pixel art

Convex → Elastic sync lag

Test Friday

Batch sync

Better Auth issues

Test Friday

Simple JWT

Scope creep

P0/P1/P2 strict

Polished P0 > buggy everything

17. Pitch Video Strategy (3 min)

Time

Content

0:00-0:20

Hook: Split-screen pixel worlds. Left = lush forest biome (birdsong). Right = grey wasteland biome (traffic). No narration.

0:20-0:50

Problem: "Biodiversity is declining. But it's invisible."

0:50-1:30

Demo: Live mic → pixel world growing. Trees sprouting. Birds landing.

1:30-2:00

Map: Browse Melbourne. Tap Royal Park = birds & pixel forest. Tap Hoddle St = traffic & grey world.

2:00-2:30

Tech: Convex + Elastic + on-device ML architecture.

2:30-2:50

Impact: "Imagine every neighbourhood monitoring itself."

2:50-3:00

Close: Split-screen. "SoundSoil. Listen to the earth. Watch it grow."

18. Lessons from UNIHACK 2025 Winners

Sensory richness → Pixel art world + real audio + social playback

Custom tech → On-device ML, custom tile engine, procedural biomes

Accessibility → Screen reader, colour-blind safe, keyboard nav

Relatability → "What does my street sound like?" (People's Choice)

Sponsor tech as core → Elastic IS the search backbone

Vibe matters → Cozy, charming, nostalgic pixel aesthetic

Creative framing → Environmental monitoring as a pixel game

19. Success Metrics

Classification < 500ms, pixel world responds within 0.5 seconds

3+ sound classes detected reliably

Trees grow visibly from birdsong, world greys from traffic

Elastic < 1 second, map works with filters

5-10 seeded recordings on map

Google login works, likes update real-time

60fps pixel rendering

Pitch video = "whoa, that's a game?"

20. Future Vision

Mobile app, eBird/iNaturalist integration, council partnerships, fine-tuned AU species model, time-lapse biome evolution, AR overlay, sound trails, user profiles, researcher API, multiplayer world (multiple people's audio feeds grow the same world), collectible rare species badges.
