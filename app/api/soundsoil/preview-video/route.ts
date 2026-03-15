import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";

type YAMNetLabel = { label: string; score: number };

interface YAMNetInput {
  topLabels: YAMNetLabel[];
  dominantClass: string;
  yamnetLabel: string;
  confidence: number;
}

async function buildVeoPrompt(input: YAMNetInput): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const labelList = input.topLabels
    .map((l) => `${l.label} (${(l.score * 100).toFixed(0)}%)`)
    .join(", ");

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `You are a Veo video prompt writer. Write a single, vivid Veo prompt for a short looping pixel-art animation based on the following audio classification result.

Audio labels: ${labelList}
Primary sound: ${input.yamnetLabel} (${(input.confidence * 100).toFixed(0)}% confidence)

Rules for the prompt:
- Style must be: retro pixel art, 16-bit video game aesthetic, chunky pixels, limited colour palette of 8–16 colours
- Include a clear Subject (what is in the scene matching the sound), Action (what it is doing), and Style ("retro pixel art animation, 16-bit, chunky pixels, scanlines")
- Camera: static or very slow pan — no handheld shake
- NO dialogue, NO speech, NO lyrics — purely visual, silent scene
- NO people, NO faces
- DO NOT mention audio, sound, music, or any auditory elements in the prompt
- Keep it under 80 words
- Output ONLY the prompt text, nothing else`,
  });

  return (
    response.text?.trim() ??
    `Retro pixel art animation of ${input.yamnetLabel}, 16-bit video game style, chunky pixels, limited colour palette, looping scene`
  );
}

async function generateVeoBuffer(input: YAMNetInput): Promise<Buffer> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const veoPrompt = await buildVeoPrompt(input);

  let operation = await ai.models.generateVideos({
    model: "veo-2.0-generate-001",
    prompt: veoPrompt,
    config: {
      aspectRatio: "16:9",
      durationSeconds: 8,
      numberOfVideos: 1,
    },
  });

  while (!operation.done) {
    await new Promise((r) => setTimeout(r, 10_000));
    operation = await ai.operations.getVideosOperation({ operation });
  }

  const generated = operation.response?.generatedVideos?.[0];
  if (!generated?.video) {
    throw new Error(
      "Veo did not return a video. It may have been blocked by safety filters.",
    );
  }

  const video = generated.video;

  if (video.videoBytes) {
    return Buffer.from(video.videoBytes, "base64");
  } else if (video.uri) {
    const videoRes = await fetch(
      `${video.uri}&key=${process.env.GEMINI_API_KEY}`,
    );
    if (!videoRes.ok)
      throw new Error(`Failed to download video: ${videoRes.statusText}`);
    const bytes = await videoRes.arrayBuffer();
    return Buffer.from(bytes);
  } else {
    throw new Error("No video bytes or URI in Veo response");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { yamnetResult } = body as { yamnetResult: YAMNetInput };

    if (!yamnetResult?.topLabels) {
      return new Response("yamnetResult with topLabels is required", {
        status: 400,
      });
    }

    const videoBuffer = await generateVeoBuffer(yamnetResult);

    return new Response(new Uint8Array(videoBuffer), {
      headers: {
        "Content-Type": "video/mp4",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Preview video generation failed:", err);
    return new Response((err as Error).message, { status: 500 });
  }
}
