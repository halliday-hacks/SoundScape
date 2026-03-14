"use node";

/**
 * Convex internal action: run YAMNet on a file stored in Convex storage.
 *
 * Trigger after an upload is created:
 *   await ctx.scheduler.runAfter(0, internal.analyzeAudio.runYAMNet, {
 *     uploadId: id,
 *     storageId: args.storageId,
 *   });
 *
 * Environment variables (set via `npx convex env set`):
 *   YAMNET_MODEL_URL — Full URL to the TF.js model.json
 *                      e.g. https://soundsoil.vercel.app/yamnet-model/model.json
 */

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { analyzeAudio } from "../lib/yamnet-analyzer";

const yamnetResultValidator = v.object({
  upload_id: v.string(),
  duration_s: v.float64(),
  n_frames: v.float64(),
  primary_label: v.string(),
  primary_confidence: v.float64(),
  needs_review: v.boolean(),
  top_labels: v.array(v.object({ label: v.string(), score: v.float64() })),
  embedding: v.array(v.float64()),
  latency_ms: v.object({
    preprocess: v.float64(),
    inference: v.float64(),
    total: v.float64(),
  }),
});

export const runYAMNet = internalAction({
  args: {
    uploadId: v.id("uploads"),
    storageId: v.id("_storage"),
  },
  returns: yamnetResultValidator,
  handler: async (ctx, args) => {
    const modelUrl = process.env.YAMNET_MODEL_URL;
    if (!modelUrl) {
      throw new Error(
        "YAMNET_MODEL_URL env var is not set. " +
          "Run: npx convex env set YAMNET_MODEL_URL <url-to-model.json>"
      );
    }

    // 1. Resolve signed URL from Convex storage
    const audioUrl = await ctx.storage.getUrl(args.storageId);
    if (!audioUrl) {
      throw new Error(`No file found for storageId: ${args.storageId}`);
    }

    // 2. Fetch raw audio bytes
    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch audio (${response.status}): ${response.statusText}`
      );
    }
    const arrayBuffer = await response.arrayBuffer();

    // 3. Run YAMNet classification
    const result = await analyzeAudio(new Uint8Array(arrayBuffer), {
      modelUrl,
      uploadId: args.uploadId,
    });

    return result;
  },
});
