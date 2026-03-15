import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { execFileSync, execSync } from "node:child_process";
import { createCanvas } from "canvas";
import GIFEncoder from "gif-encoder-2";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

type YAMNetResult = {
  primary_label: string;
  primary_confidence: number;
  duration_s: number;
  top_labels: { label: string; score: number }[];
  needs_review: boolean;
};

// ---------------------------------------------------------------------------
// Skill content loader (reused from /api/soundsoil/route.ts)
// ---------------------------------------------------------------------------

function loadSkillContent(): string {
  const skillPath = path.resolve("soundsoil-pixelart.skill");
  const extract = (entry: string) =>
    execSync(`unzip -p "${skillPath}" "*/${entry}"`, { encoding: "utf8" });
  return [
    extract("SKILL.md"),
    "## Label → Visual Map Reference",
    extract("references/label-visual-map.md"),
  ].join("\n\n---\n\n");
}

// ---------------------------------------------------------------------------
// GIF generation → Buffer
// ---------------------------------------------------------------------------

async function generateGifBuffer(result: YAMNetResult): Promise<Buffer> {
  const systemPrompt = loadSkillContent();
  const client = new Anthropic();
  const payload = {
    primary_label: result.primary_label,
    primary_confidence: result.primary_confidence,
    duration_s: result.duration_s,
    top_labels: result.top_labels,
    needs_review: result.needs_review,
  };

  const aiStream = client.messages.stream({
    model: "claude-haiku-4-5",
    max_tokens: 8000,
    system:
      systemPrompt +
      `

---

## IMPORTANT: Output Format Change

Instead of p5.js HTML, output a plain JavaScript function body for node-canvas.
The function signature is:

  function drawFrame(ctx, W, H, frame, totalFrames, data) { ...your code... }

- ctx — node-canvas CanvasRenderingContext2D
- W, H — canvas size in pixels (640 × 480)
- frame — current frame index (0-based)
- totalFrames — total frames (60)
- data — the YAMNet payload object (primary_label, primary_confidence, top_labels, duration_s, needs_review)

Rules:
- Use ONLY ctx methods: fillStyle, fillRect, strokeStyle, strokeRect, beginPath, moveTo, lineTo, stroke, arc, fill, clearRect
- NO p5.js, NO Math.random() — use a seeded PRNG:
    let _s = 0; for (let i=0; i<data.primary_label.length; i++) _s=(_s*31+data.primary_label.charCodeAt(i))|0;
    function rand(){_s^=_s<<13;_s^=_s>>17;_s^=_s<<5;return((_s<0?~_s+1:_s)%1e6)/1e6;}
- Animate using 'frame' (0 → totalFrames-1) for motion. Use frame for time-based offsets.
- Keep it pixel-art style: use large rectangles, limited palette, integer positions
- Pixelated look: draw at a low logical resolution (e.g., 16px blocks scaled to fit W×H)
- NO external resources, NO fetch, NO require`,
    tools: [
      {
        name: "output_draw_fn",
        description: "Output the drawFrame function body string",
        input_schema: {
          type: "object" as const,
          properties: {
            drawFnBody: {
              type: "string",
              description: "The JavaScript function body",
            },
          },
          required: ["drawFnBody"],
          additionalProperties: false,
        },
      },
    ],
    tool_choice: { type: "tool", name: "output_draw_fn" },
    messages: [
      {
        role: "user" as const,
        content: `Generate pixel art for this audio:\n\n${JSON.stringify(payload, null, 2)}`,
      },
    ],
  });

  const finalMsg = await aiStream.finalMessage();
  const toolUse = finalMsg.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use")
    throw new Error("Claude did not return draw function");
  const drawFnBody = (toolUse.input as { drawFnBody: string }).drawFnBody;

  const W = 640,
    H = 480,
    TOTAL_FRAMES = 60,
    FPS = 12;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const drawFrame = new Function(
    "ctx",
    "W",
    "H",
    "frame",
    "totalFrames",
    "data",
    drawFnBody,
  );

  const encoder = new GIFEncoder(W, H, "neuquant", true, TOTAL_FRAMES);
  encoder.setRepeat(0);
  encoder.setDelay(Math.round(1000 / FPS));
  encoder.setQuality(10);

  const chunks: Buffer[] = [];
  const gifDone = new Promise<void>((resolve, reject) =>
    encoder
      .createReadStream()
      .on("data", (chunk: Buffer) => chunks.push(chunk))
      .on("end", resolve)
      .on("error", reject),
  );

  encoder.start();

  for (let f = 0; f < TOTAL_FRAMES; f++) {
    ctx.clearRect(0, 0, W, H);
    try {
      drawFrame(ctx, W, H, f, TOTAL_FRAMES, payload);
    } catch (e) {
      if (f === 0) throw new Error(`drawFrame error: ${(e as Error).message}`);
    }
    encoder.addFrame(
      ctx.getImageData(0, 0, W, H).data as unknown as CanvasRenderingContext2D,
    );
  }

  encoder.finish();
  await gifDone;

  return Buffer.concat(chunks);
}

// ---------------------------------------------------------------------------
// Veo video generation → Buffer
// ---------------------------------------------------------------------------

async function buildVeoPrompt(result: YAMNetResult): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const labelList = result.top_labels
    .map((l) => `${l.label} (${(l.score * 100).toFixed(0)}%)`)
    .join(", ");

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `You are a Veo video prompt writer. Write a single, vivid Veo prompt for a short looping pixel-art animation based on the following audio classification result.

Audio labels: ${labelList}
Primary sound: ${result.primary_label} (${(result.primary_confidence * 100).toFixed(0)}% confidence)
Duration: ${result.duration_s.toFixed(1)}s

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
    `Retro pixel art animation of ${result.primary_label}, 16-bit video game style, chunky pixels, limited colour palette, looping scene`
  );
}

async function generateVeoBuffer(result: YAMNetResult): Promise<Buffer> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const veoPrompt = await buildVeoPrompt(result);

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

// ---------------------------------------------------------------------------
// Upload a buffer to Convex storage and return the storageId
// ---------------------------------------------------------------------------

async function uploadToConvexStorage(
  buffer: Buffer,
  contentType: string,
): Promise<Id<"_storage">> {
  const uploadUrl = await fetchMutation(api.uploads.generateUploadUrl);
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: new Uint8Array(buffer),
  });
  if (!res.ok) throw new Error(`Storage upload failed (${res.status})`);
  const { storageId } = await res.json();
  return storageId as Id<"_storage">;
}

// ---------------------------------------------------------------------------
// POST /api/soundsoil/generate
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { uploadId, audioStorageId } = body as {
    uploadId: string;
    audioStorageId: string;
  };

  if (!uploadId || !audioStorageId) {
    return NextResponse.json(
      { error: "uploadId and audioStorageId are required" },
      { status: 400 },
    );
  }

  const typedUploadId = uploadId as Id<"uploads">;
  const typedStorageId = audioStorageId as Id<"_storage">;

  try {
    // 1. Get audio URL from Convex storage
    const audioUrl = await fetchQuery(api.uploads.getStorageUrl, {
      storageId: typedStorageId,
    });
    if (!audioUrl) {
      return NextResponse.json(
        { error: "Audio file not found in storage" },
        { status: 404 },
      );
    }

    // 2. Download audio to temp file for YAMNet
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) throw new Error("Failed to download audio");
    const audioBytes = await audioRes.arrayBuffer();
    const tmpWav = path.join(os.tmpdir(), `soundsoil-gen-${Date.now()}.wav`);
    fs.writeFileSync(tmpWav, Buffer.from(audioBytes));

    // 3. Run YAMNet classification
    let yamnetResult: YAMNetResult;
    try {
      const raw = execFileSync(
        "bun",
        [path.resolve("scripts/test-yamnet.ts"), tmpWav],
        { encoding: "utf8", cwd: path.resolve(".") },
      );
      yamnetResult = JSON.parse(raw);
    } finally {
      fs.rmSync(tmpWav, { force: true });
    }

    // 4. Patch upload with YAMNet labels and set statuses to "generating"
    await fetchMutation(api.uploads.patchVisuals, {
      uploadId: typedUploadId,
      yamnetLabels: yamnetResult.top_labels,
      gifStatus: "generating",
      videoStatus: "generating",
    });

    // 5. Run GIF + Veo generation in parallel
    const [gifResult, veoResult] = await Promise.allSettled([
      generateGifBuffer(yamnetResult),
      generateVeoBuffer(yamnetResult),
    ]);

    // 6. Handle GIF result
    if (gifResult.status === "fulfilled") {
      const gifStorageId = await uploadToConvexStorage(
        gifResult.value,
        "image/gif",
      );
      await fetchMutation(api.uploads.patchVisuals, {
        uploadId: typedUploadId,
        gifStorageId,
        gifStatus: "done",
      });
    } else {
      console.error("GIF generation failed:", gifResult.reason);
      await fetchMutation(api.uploads.patchVisuals, {
        uploadId: typedUploadId,
        gifStatus: "failed",
      });
    }

    // 7. Handle Veo result
    if (veoResult.status === "fulfilled") {
      const videoStorageId = await uploadToConvexStorage(
        veoResult.value,
        "video/mp4",
      );
      await fetchMutation(api.uploads.patchVisuals, {
        uploadId: typedUploadId,
        videoStorageId,
        videoStatus: "done",
      });
    } else {
      console.error("Veo generation failed:", veoResult.reason);
      await fetchMutation(api.uploads.patchVisuals, {
        uploadId: typedUploadId,
        videoStatus: "failed",
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Generation pipeline failed:", err);

    // Best-effort: mark both as failed
    try {
      await fetchMutation(api.uploads.patchVisuals, {
        uploadId: typedUploadId,
        gifStatus: "failed",
        videoStatus: "failed",
      });
    } catch {
      // ignore patch failure
    }

    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
