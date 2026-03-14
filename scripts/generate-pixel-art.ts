/**
 * WAV → YAMNet → Claude → GIF
 *
 * Usage:
 *   bun scripts/generate-pixel-art.ts <wav-file> [output.gif] [model-url]
 *
 * Requires: ANTHROPIC_API_KEY env var
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import { createCanvas } from "canvas";
import GIFEncoder from "gif-encoder-2";
import Anthropic from "@anthropic-ai/sdk";
import { analyzeAudio } from "../lib/yamnet-analyzer";

// ---------------------------------------------------------------------------
// Load skill from zip
// ---------------------------------------------------------------------------

function loadSkillContent(skillPath: string): string {
  const abs = path.resolve(skillPath);
  const extract = (entry: string) =>
    execSync(`unzip -p "${abs}" "*/${entry}"`, { encoding: "utf8" });
  return [
    extract("SKILL.md"),
    "## Label → Visual Map Reference",
    extract("references/label-visual-map.md"),
  ].join("\n\n---\n\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const wavPath = process.argv[2];
  const outputGif = process.argv[3] ?? "output.gif";
  const modelUrl =
    process.argv[4] ??
    `file://${path.resolve("public/yamnet-model")}/model.json`;

  if (!wavPath) {
    console.error("Usage: bun scripts/generate-pixel-art.ts <wav-file> [output.gif] [model-url]");
    process.exit(1);
  }

  // Step 1: YAMNet
  console.error(`[1/3] Analyzing: ${path.resolve(wavPath)}`);
  const audioBuffer = new Uint8Array(fs.readFileSync(path.resolve(wavPath)));
  const result = await analyzeAudio(audioBuffer, { modelUrl });
  console.error(`      → ${result.primary_label} (${(result.primary_confidence * 100).toFixed(1)}%) — ${result.top_labels.map(l => l.label).join(", ")}`);

  // Step 2: Claude → drawFrame function
  console.error("\n[2/3] Generating art via Claude...");
  const systemPrompt = loadSkillContent(path.resolve("soundsoil-pixelart.skill"));
  const client = new Anthropic();

  const payload = {
    primary_label: result.primary_label,
    primary_confidence: result.primary_confidence,
    duration_s: result.duration_s,
    top_labels: result.top_labels,
    needs_review: result.needs_review,
  };

  const stream = client.messages.stream({
    model: "claude-haiku-4-5",
    max_tokens: 8000,
    system: systemPrompt + `

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
              description: "The JavaScript function body (contents of the drawFrame function, not the function declaration itself)",
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

  process.stderr.write("      → streaming");
  stream.on("text", () => process.stderr.write("."));
  const finalMsg = await stream.finalMessage();
  process.stderr.write(" done\n");
  console.error(`      → tokens: ${finalMsg.usage.input_tokens} in / ${finalMsg.usage.output_tokens} out`);

  const toolUse = finalMsg.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    console.error("Error: Claude did not return draw function");
    process.exit(1);
  }
  const drawFnBody = (toolUse.input as { drawFnBody: string }).drawFnBody;

  // Step 3: Render frames → GIF
  console.error("\n[3/3] Rendering GIF...");
  const W = 640, H = 480, TOTAL_FRAMES = 60, FPS = 12;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const drawFrame = new Function("ctx", "W", "H", "frame", "totalFrames", "data", drawFnBody);

  const encoder = new GIFEncoder(W, H, "neuquant", true, TOTAL_FRAMES);
  const absOutput = path.resolve(outputGif);
  const out = fs.createWriteStream(absOutput);
  encoder.createReadStream().pipe(out);
  encoder.start();
  encoder.setRepeat(0);
  encoder.setDelay(Math.round(1000 / FPS));
  encoder.setQuality(10);

  for (let f = 0; f < TOTAL_FRAMES; f++) {
    ctx.clearRect(0, 0, W, H);
    try {
      drawFrame(ctx, W, H, f, TOTAL_FRAMES, payload);
    } catch (e) {
      console.error(`\nFrame ${f} error:`, (e as Error).message);
    }
    encoder.addFrame(ctx as unknown as CanvasRenderingContext2D);
    process.stderr.write(`\r      → frame ${f + 1}/${TOTAL_FRAMES}`);
  }

  encoder.finish();
  await new Promise((r) => out.on("finish", r));
  process.stderr.write("\n");

  const sizeKb = Math.round(fs.statSync(absOutput).size / 1024);
  console.error(`\nDone! ${absOutput} (${sizeKb} KB)`);
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
