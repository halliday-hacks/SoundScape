"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

/**
 * Sync a single upload document to Elastic Cloud.
 *
 * Flow:
 *  1. Fetch the upload doc from Convex
 *  2. Build the Elastic document shape
 *  3. PUT to soundsoil-uploads/_doc/<id>
 *  4. On success → call markSynced to flip elasticSynced: true
 */
export const syncUpload = internalAction({
  args: { id: v.id("uploads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ELASTIC_URL = process.env.ELASTIC_URL;
    const ELASTIC_API_KEY = process.env.ELASTIC_API_KEY;

    if (!ELASTIC_URL || !ELASTIC_API_KEY) {
      console.error("[elastic] Missing ELASTIC_URL or ELASTIC_API_KEY env vars");
      return null;
    }

    // 1. Fetch the upload doc
    const upload = await ctx.runQuery(internal.uploads.getByIdInternal, {
      uploadId: args.id,
    });

    if (!upload) {
      console.warn(`[elastic] Upload ${args.id} not found — skipping sync`);
      return null;
    }

    // 2. Build the Elastic document
    const elasticDoc: Record<string, unknown> = {
      upload_id: upload._id,
      user_id: upload.userId,
      title: upload.title,
      description: upload.description ?? null,
      timestamp: upload._creationTime,
      location_name: upload.locationLabel ?? null,
      dominant_class: upload.dominantClass ?? null,
      tags: upload.tags ?? [],
      likes: upload.likeCount,
      listen_count: upload.listenCount,
      biodiversity_score: upload.biodiversityScore ?? null,
      duration_seconds: upload.durationSeconds ?? null,
    };

    // Add geo_point only when both lat and lon are present
    if (upload.lat != null && upload.lon != null) {
      elasticDoc.geo = { lat: upload.lat, lon: upload.lon };
    }

    // 3. PUT to Elastic
    const url = `${ELASTIC_URL}/soundsoil-uploads/_doc/${upload._id}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `ApiKey ${ELASTIC_API_KEY}`,
        },
        body: JSON.stringify(elasticDoc),
      });
    } catch (err) {
      console.error(`[elastic] Network error syncing ${args.id}:`, err);
      return null;
    }

    if (!response.ok) {
      const body = await response.text();
      console.error(
        `[elastic] PUT failed for ${args.id} — ${response.status}: ${body}`
      );
      return null;
    }

    // 4. Mark synced in Convex
    await ctx.runMutation(internal.uploads.markSynced, {
      uploadId: args.id,
    });

    console.log(`[elastic] Synced upload ${args.id} ✓`);
    return null;
  },
});

/**
 * Cron sweep — called every 60 seconds.
 * Finds all uploads with elasticSynced: false and schedules a syncUpload for each.
 */
export const sweepUnsynced = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const ids = await ctx.runQuery(internal.uploads.getUnsynced);
    if (ids.length === 0) return null;

    console.log(`[elastic] Sweep found ${ids.length} unsynced upload(s)`);
    for (const id of ids) {
      await ctx.scheduler.runAfter(0, internal.elastic.syncUpload, { id });
    }
    return null;
  },
});

/**
 * Force-resync a specific upload by resetting elasticSynced to false
 * and immediately scheduling a sync action.
 * Callable from the frontend via an internal mutation + action pair.
 */
export const forceSync = internalAction({
  args: { id: v.id("uploads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Reset the flag so the cron sweep also picks it up if the action fails
    await ctx.runMutation(internal.uploads.resetSyncFlag, { uploadId: args.id });
    await ctx.runAction(internal.elastic.syncUpload, { id: args.id });
    return null;
  },
});
