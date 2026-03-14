import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  classificationEvents: defineTable({
    sessionId: v.string(),
    userId: v.optional(v.string()),
    timestamp: v.number(), // Unix ms
    lat: v.optional(v.float64()),
    lon: v.optional(v.float64()),
    // Classification scores (0.0–1.0)
    bird: v.float64(),
    insect: v.float64(),
    traffic: v.float64(),
    wind: v.float64(),
    construction: v.float64(),
    silence: v.float64(),
    dominantClass: v.string(), // "bird" | "insect" | "traffic" | "wind" | "construction" | "silence"
    confidence: v.float64(),
    species: v.optional(v.string()), // e.g. "Dacelo novaeguineae"
    speciesCommon: v.optional(v.string()), // e.g. "Laughing Kookaburra"
    biodiversityScore: v.float64(), // 0–100
    audioFingerprintHash: v.optional(v.string()),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_userId", ["userId"])
    .index("by_sessionId_timestamp", ["sessionId", "timestamp"])
    .index("by_dominantClass", ["dominantClass"]),

  uploads: defineTable({
    userId: v.string(),
    storageId: v.optional(v.string()), // Convex file storage ID
    title: v.string(),
    description: v.optional(v.string()),
    durationSeconds: v.optional(v.float64()),
    lat: v.optional(v.float64()),
    lon: v.optional(v.float64()),
    locationLabel: v.optional(v.string()), // e.g. "Fitzroy Gardens, Melbourne"
    biodiversityScore: v.optional(v.float64()),
    dominantClass: v.optional(v.string()),
    likeCount: v.number(),
    listenCount: v.number(),
    tags: v.optional(v.array(v.string())),
  })
    .index("by_userId", ["userId"])
    .index("by_likeCount", ["likeCount"])
    .index("by_listenCount", ["listenCount"]),

  userLikes: defineTable({
    userId: v.string(),
    uploadId: v.id("uploads"),
  })
    .index("by_userId", ["userId"])
    .index("by_uploadId", ["uploadId"])
    .index("by_userId_uploadId", ["userId", "uploadId"]),
});
