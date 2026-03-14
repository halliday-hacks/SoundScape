import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    sessionId: v.string(),
    userId: v.optional(v.string()),
    timestamp: v.number(),
    lat: v.optional(v.float64()),
    lon: v.optional(v.float64()),
    bird: v.float64(),
    insect: v.float64(),
    traffic: v.float64(),
    wind: v.float64(),
    construction: v.float64(),
    silence: v.float64(),
    dominantClass: v.string(),
    confidence: v.float64(),
    species: v.optional(v.string()),
    speciesCommon: v.optional(v.string()),
    biodiversityScore: v.float64(),
    audioFingerprintHash: v.optional(v.string()),
  },
  returns: v.id("classificationEvents"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("classificationEvents", args);
  },
});

export const getBySession = query({
  args: {
    sessionId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("classificationEvents"),
      _creationTime: v.number(),
      sessionId: v.string(),
      userId: v.optional(v.string()),
      timestamp: v.number(),
      lat: v.optional(v.float64()),
      lon: v.optional(v.float64()),
      bird: v.float64(),
      insect: v.float64(),
      traffic: v.float64(),
      wind: v.float64(),
      construction: v.float64(),
      silence: v.float64(),
      dominantClass: v.string(),
      confidence: v.float64(),
      species: v.optional(v.string()),
      speciesCommon: v.optional(v.string()),
      biodiversityScore: v.float64(),
      audioFingerprintHash: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("classificationEvents")
      .withIndex("by_sessionId_timestamp", (q) =>
        q.eq("sessionId", args.sessionId)
      )
      .order("desc")
      .take(limit);
  },
});
