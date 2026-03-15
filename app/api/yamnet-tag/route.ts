import { NextRequest } from "next/server";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { GoogleGenAI } from "@google/genai";

type YAMNetLabel = { label: string; score: number };
type YAMNetResult = {
  primary_label: string;
  primary_confidence: number;
  duration_s: number;
  top_labels: YAMNetLabel[];
};

// Maps AudioSet label keywords → our 7 sound types (ordered by priority)
const SOUND_TYPE_RULES: { type: string; keywords: string[] }[] = [
  {
    type: "birds",
    keywords: [
      "bird", "birdsong", "chirp", "warble", "crow", "duck", "canary",
      "rooster", "pigeon", "owl", "parrot", "finch", "sparrow", "hawk",
      "eagle", "wren", "goose", "seagull", "frog", "amphibian", "fowl",
    ],
  },
  {
    type: "insects",
    keywords: [
      "insect", "cricket", "bee", "fly", "mosquito", "locust", "cicada",
      "buzz", "hum", "wasp",
    ],
  },
  {
    type: "rain",
    keywords: [
      "rain", "thunder", "storm", "drizzle", "raindrop", "hail", "wind",
      "rustling", "water", "stream", "river",
    ],
  },
  {
    type: "traffic",
    keywords: [
      "traffic", "car", "vehicle", "bus", "truck", "engine", "horn",
      "motor", "train", "motorcycle", "subway", "rail", "aircraft",
      "helicopter", "siren", "alarm",
    ],
  },
  {
    type: "music",
    keywords: [
      "music", "guitar", "piano", "drum", "bass", "violin", "flute",
      "trumpet", "singing", "vocal", "choir", "orchestra", "jazz",
      "blues", "beat", "melody", "instrument", "song", "chant",
    ],
  },
  {
    type: "construction",
    keywords: [
      "drill", "jackhammer", "saw", "construction", "hammer", "tool",
      "power tool", "grind", "machine", "bang", "impact",
    ],
  },
  {
    type: "silence",
    keywords: ["silence", "quiet", "static", "hiss", "noise"],
  },
];

function mapToSoundType(topLabels: YAMNetLabel[]): {
  type: string;
  yamnetLabel: string;
  confidence: number;
} {
  for (const { label, score } of topLabels) {
    const lower = label.toLowerCase();
    for (const { type, keywords } of SOUND_TYPE_RULES) {
      if (keywords.some((k) => lower.includes(k))) {
        return { type, yamnetLabel: label, confidence: score };
      }
    }
  }
  return {
    type: "silence",
    yamnetLabel: topLabels[0]?.label ?? "Unknown",
    confidence: topLabels[0]?.score ?? 0,
  };
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("audio") as File | null;
  if (!file) return new Response("No audio file", { status: 400 });

  const tmpWav = path.join(os.tmpdir(), `yamtag-${Date.now()}.wav`);
  try {
    const arrayBuffer = await file.arrayBuffer();
    fs.writeFileSync(tmpWav, Buffer.from(arrayBuffer));

    const raw = execFileSync(
      "bun",
      [path.resolve("scripts/test-yamnet.ts"), tmpWav],
      { encoding: "utf8", cwd: path.resolve(".") },
    );

    const result: YAMNetResult = JSON.parse(raw);
    const mapped = mapToSoundType(result.top_labels);
    const topLabels = result.top_labels.slice(0, 5);

    // Generate AI title + description via Gemini Flash
    let suggestedTitle = "";
    let suggestedDescription = "";
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const labelList = topLabels
        .map((l) => `${l.label} (${(l.score * 100).toFixed(0)}%)`)
        .join(", ");
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: `You are naming nature sound recordings for a map-based app. Given these audio classification labels, generate:
1. A creative, evocative title (5-8 words)
2. A 1-2 sentence description of what the listener might hear

Audio labels: ${labelList}
Primary sound: ${mapped.yamnetLabel} (${(mapped.confidence * 100).toFixed(0)}% confidence)
Sound type: ${mapped.type}

Respond in exactly this JSON format, nothing else:
{"title": "...", "description": "..."}`,
      });
      let text = response.text?.trim() ?? "";
      // Strip markdown code fences if present
      text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      const jsonCandidate = (text.match(/\{[\s\S]*\}/)?.[0] ?? text)
        .replace(/,\s*([}\]])/g, "$1");
      const parsed = JSON.parse(jsonCandidate);
      suggestedTitle = parsed.title ?? "";
      suggestedDescription = parsed.description ?? "";
    } catch (err) {
      console.error("Gemini title/description generation failed:", err);
    }

    return Response.json({
      dominantClass: mapped.type,
      yamnetLabel: mapped.yamnetLabel,
      confidence: mapped.confidence,
      topLabels,
      suggestedTitle,
      suggestedDescription,
    });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  } finally {
    fs.rmSync(tmpWav, { force: true });
  }
}
