import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const uploadFields = v.object({
  _id: v.id("uploads"),
  _creationTime: v.number(),
  userId: v.string(),
  storageId: v.id("_storage"),
  title: v.string(),
  description: v.optional(v.string()),
  durationSeconds: v.optional(v.float64()),
  lat: v.optional(v.float64()),
  lon: v.optional(v.float64()),
  locationLabel: v.optional(v.string()),
  biodiversityScore: v.optional(v.float64()),
  dominantClass: v.optional(v.string()),
  likeCount: v.number(),
  listenCount: v.number(),
  tags: v.optional(v.array(v.string())),
  elasticSynced: v.optional(v.boolean()),
});

export const create = mutation({
  args: {
    userId: v.string(),
    storageId: v.id("_storage"),
    title: v.string(),
    description: v.optional(v.string()),
    durationSeconds: v.optional(v.float64()),
    lat: v.optional(v.float64()),
    lon: v.optional(v.float64()),
    locationLabel: v.optional(v.string()),
    biodiversityScore: v.optional(v.float64()),
    dominantClass: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  returns: v.id("uploads"),
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("uploads", {
      ...args,
      likeCount: 0,
      listenCount: 0,
      elasticSynced: false,
    });
    await ctx.scheduler.runAfter(0, internal.elastic.syncUpload, { id });
    return id;
  },
});

export const getById = query({
  args: { uploadId: v.id("uploads") },
  returns: v.union(uploadFields, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.uploadId);
  },
});

export const getRecent = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(uploadFields),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    return await ctx.db.query("uploads").order("desc").take(limit);
  },
});

export const like = mutation({
  args: {
    uploadId: v.id("uploads"),
    userId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Check if already liked
    const existing = await ctx.db
      .query("userLikes")
      .withIndex("by_userId_uploadId", (q) =>
        q.eq("userId", args.userId).eq("uploadId", args.uploadId)
      )
      .unique();

    if (existing) {
      // Unlike
      await ctx.db.delete(existing._id);
      const upload = await ctx.db.get(args.uploadId);
      if (upload) {
        await ctx.db.patch(args.uploadId, {
          likeCount: Math.max(0, upload.likeCount - 1),
        });
      }
    } else {
      // Like
      await ctx.db.insert("userLikes", {
        userId: args.userId,
        uploadId: args.uploadId,
      });
      const upload = await ctx.db.get(args.uploadId);
      if (upload) {
        await ctx.db.patch(args.uploadId, {
          likeCount: upload.likeCount + 1,
        });
      }
    }
    return null;
  },
});

export const incrementListenCount = mutation({
  args: { uploadId: v.id("uploads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const upload = await ctx.db.get(args.uploadId);
    if (!upload) return null;
    await ctx.db.patch(args.uploadId, {
      listenCount: upload.listenCount + 1,
    });
    return null;
  },
});

// ============================================
// FILE STORAGE
// ============================================

/**
 * Generate a short-lived upload URL for the client to upload a file directly to Convex storage.
 * Call this first, then POST the file to the returned URL.
 */
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Get a public URL for a stored file by its storageId.
 * Returns null if the file doesn't exist.
 */
export const getStorageUrl = query({
  args: { storageId: v.id("_storage") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

/**
 * Delete an upload and its associated audio file from storage.
 * Also removes any userLikes for this upload.
 */
// Internal query used by the elastic sync action (avoids exposing to public API)
export const getByIdInternal = internalQuery({
  args: { uploadId: v.id("uploads") },
  returns: v.union(
    v.object({
      _id: v.id("uploads"),
      _creationTime: v.number(),
      userId: v.string(),
      storageId: v.id("_storage"),
      title: v.string(),
      description: v.optional(v.string()),
      durationSeconds: v.optional(v.float64()),
      lat: v.optional(v.float64()),
      lon: v.optional(v.float64()),
      locationLabel: v.optional(v.string()),
      biodiversityScore: v.optional(v.float64()),
      dominantClass: v.optional(v.string()),
      likeCount: v.number(),
      listenCount: v.number(),
      tags: v.optional(v.array(v.string())),
      elasticSynced: v.optional(v.boolean()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.uploadId);
  },
});

export const markSynced = internalMutation({
  args: { uploadId: v.id("uploads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.uploadId, { elasticSynced: true });
    return null;
  },
});

// Used by the elastic cron sweep to find all uploads not yet pushed to Elastic
export const getUnsynced = internalQuery({
  args: {},
  returns: v.array(v.id("uploads")),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("uploads")
      .withIndex("by_elasticSynced", (q) => q.eq("elasticSynced", false))
      .collect();
    return rows.map((r) => r._id);
  },
});

export const resetSyncFlag = internalMutation({
  args: { uploadId: v.id("uploads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.uploadId, { elasticSynced: false });
    return null;
  },
});

export const deleteUpload = mutation({
  args: { uploadId: v.id("uploads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const upload = await ctx.db.get(args.uploadId);
    if (!upload) return null;

    // Delete the audio file from storage (if it exists)
    if (upload.storageId) {
      await ctx.storage.delete(upload.storageId);
    }

    // Delete all likes for this upload
    const likes = await ctx.db
      .query("userLikes")
      .withIndex("by_uploadId", (q) => q.eq("uploadId", args.uploadId))
      .collect();
    
    for (const like of likes) {
      await ctx.db.delete(like._id);
    }

    // Delete the upload record
    await ctx.db.delete(args.uploadId);

    return null;
  },
});
