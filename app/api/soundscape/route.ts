import { NextRequest } from "next/server";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { execSync, execFileSync } from "node:child_process";
import { createCanvas } from "canvas";
import GIFEncoder from "gif-encoder-2";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

function loadSkillContent(): string {
  const skillPath = path.resolve("soundscape-pixelart.skill");
  const extract = (entry: string) =>
    execSync(`unzip -p "${skillPath}" "*/${entry}"`, { encoding: "utf8" });
  return [
    extract("SKILL.md"),
    "## Label → Visual Map Reference",
    extract("references/label-visual-map.md"),
  ].join("\n\n---\n\n");
}

function send(
  controller: ReadableStreamDefaultController,
  event: string,
  data: unknown,
) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(new TextEncoder().encode(payload));
}

type YAMNetResult = {
  primary_label: string;
  primary_confidence: number;
  duration_s: number;
  top_labels: { label: string; score: number }[];
  needs_review: boolean;
};

// ---------------------------------------------------------------------------
// Build a pixel-art Veo prompt from YAMNet labels via Gemini Flash
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

// ---------------------------------------------------------------------------
// Veo video generation path
// ---------------------------------------------------------------------------

async function generateVeoVideo(
  result: YAMNetResult,
  controller: ReadableStreamDefaultController,
): Promise<void> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // Step 2: Build Veo prompt with Gemini Flash
  send(controller, "progress", {
    step: 2,
    label: "Writing Veo prompt with Gemini…",
  });
  const veoPrompt = await buildVeoPrompt(result);
  send(controller, "progress", {
    step: 2,
    label: "Veo prompt ready",
    detail: veoPrompt,
  });

  // Step 3: Kick off Veo generation
  send(controller, "progress", {
    step: 3,
    label: "Starting Veo video generation…",
  });

  let operation = await ai.models.generateVideos({
    model: "veo-2.0-generate-001",
    prompt: veoPrompt,
    config: {
      aspectRatio: "16:9",
      durationSeconds: 8,
      numberOfVideos: 1,
    },
  });

  // Poll until done, streaming elapsed time back to the client
  let pollCount = 0;
  while (!operation.done) {
    pollCount++;
    const elapsed = pollCount * 10;
    send(controller, "progress", {
      step: 3,
      label: `Generating video… (~${elapsed}s elapsed)`,
    });
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

  // Prefer inline bytes; fall back to fetching the URI
  let base64: string;
  if (video.videoBytes) {
    base64 = video.videoBytes;
  } else if (video.uri) {
    send(controller, "progress", { step: 3, label: "Downloading video…" });
    const videoRes = await fetch(
      `${video.uri}&key=${process.env.GEMINI_API_KEY}`,
    );
    if (!videoRes.ok)
      throw new Error(`Failed to download video: ${videoRes.statusText}`);
    const bytes = await videoRes.arrayBuffer();
    base64 = Buffer.from(bytes).toString("base64");
  } else {
    throw new Error("No video bytes or URI in Veo response");
  }

  send(controller, "done", { video: `data:video/mp4;base64,${base64}` });
}

// ---------------------------------------------------------------------------
// GIF generation path (unchanged)
// ---------------------------------------------------------------------------

async function generateGif(
  result: YAMNetResult,
  controller: ReadableStreamDefaultController,
): Promise<void> {
  // Step 2: Claude
  send(controller, "progress", {
    step: 2,
    label: "Generating pixel art with Claude…",
  });

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
        role: "user",
        content: `Generate pixel art for this audio:\n\n${JSON.stringify(payload, null, 2)}`,
      },
    ],
  });

  const finalMsg = await aiStream.finalMessage();
  const toolUse = finalMsg.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use")
    throw new Error("Claude did not return draw function");
  const drawFnBody = (toolUse.input as { drawFnBody: string }).drawFnBody;

  // Step 3: Render GIF
  send(controller, "progress", { step: 3, label: "Rendering GIF…" });

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

    if (f % 10 === 9) {
      send(controller, "progress", {
        step: 3,
        label: `Rendering GIF… (${f + 1}/${TOTAL_FRAMES} frames)`,
        frameProgress: (f + 1) / TOTAL_FRAMES,
      });
    }
  }

  encoder.finish();
  await gifDone;

  const gifBuffer = Buffer.concat(chunks);
  const base64 = gifBuffer.toString("base64");
  send(controller, "done", { gif: `data:image/gif;base64,${base64}` });
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("audio") as File | null;
  const mode = (formData.get("mode") as string | null) ?? "gif";
  if (!file) return new Response("No audio file", { status: 400 });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Step 1: YAMNet — shell out to CLI to avoid TF.js/fetch issues in Next.js
        send(controller, "progress", {
          step: 1,
          label: "Analysing audio with YAMNet…",
        });

        const arrayBuffer = await file.arrayBuffer();
        const tmpWav = path.join(os.tmpdir(), `soundscape-${Date.now()}.wav`);
        fs.writeFileSync(tmpWav, Buffer.from(arrayBuffer));

        let result: YAMNetResult;
        try {
          const raw = execFileSync(
            "bun",
            [path.resolve("scripts/test-yamnet.ts"), tmpWav],
            { encoding: "utf8", cwd: path.resolve(".") },
          );
          result = JSON.parse(raw);
        } finally {
          fs.rmSync(tmpWav, { force: true });
        }

        send(controller, "progress", {
          step: 1,
          label: `Detected: ${result.primary_label} (${(result.primary_confidence * 100).toFixed(0)}%)`,
          detail: result.top_labels.map((l) => l.label).join(", "),
        });

        if (mode === "veo") {
          await generateVeoVideo(result, controller);
        } else {
          await generateGif(result, controller);
        }
      } catch (err) {
        send(controller, "error", { message: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
