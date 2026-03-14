import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const uploadFields = v.object({
  _id: v.id("uploads"),
  _creationTime: v.number(),
  userId: v.string(),
  storageId: v.optional(v.string()),
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
});

export const create = mutation({
  args: {
    userId: v.string(),
    storageId: v.optional(v.string()),
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
    return await ctx.db.insert("uploads", {
      ...args,
      likeCount: 0,
      listenCount: 0,
    });
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
