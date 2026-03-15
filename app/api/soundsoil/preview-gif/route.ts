import { NextRequest } from "next/server";
import path from "node:path";
import { execSync } from "node:child_process";
import { createCanvas } from "canvas";
import GIFEncoder from "gif-encoder-2";
import Anthropic from "@anthropic-ai/sdk";

type YAMNetLabel = { label: string; score: number };

interface YAMNetInput {
  topLabels: YAMNetLabel[];
  dominantClass: string;
  yamnetLabel: string;
  confidence: number;
}

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

async function generateGifBuffer(input: YAMNetInput): Promise<Buffer> {
  const systemPrompt = loadSkillContent();
  const client = new Anthropic();
  const payload = {
    primary_label: input.yamnetLabel,
    primary_confidence: input.confidence,
    duration_s: 5,
    top_labels: input.topLabels,
    needs_review: false,
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { yamnetResult } = body as { yamnetResult: YAMNetInput };

    if (!yamnetResult?.topLabels) {
      return new Response("yamnetResult with topLabels is required", {
        status: 400,
      });
    }

    const gifBuffer = await generateGifBuffer(yamnetResult);

    return new Response(new Uint8Array(gifBuffer), {
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Preview GIF generation failed:", err);
    return new Response((err as Error).message, { status: 500 });
  }
}
