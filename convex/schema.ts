import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  classificationEvents: defineTable({
    sessionId: v.string(),
    userId: v.optional(v.string()),
    timestamp: v.number(), // Unix ms
    lat: v.optional(v.float64()),
    lon: v.optional(v.float64()),
    // Classification scores (0.0–1.0) — optional to tolerate legacy records with different field names
    bird: v.optional(v.float64()), // legacy singular form
    insect: v.optional(v.float64()), // legacy singular form
    wind: v.optional(v.float64()), // legacy field
    birds: v.optional(v.float64()),
    insects: v.optional(v.float64()),
    rain: v.optional(v.float64()),
    traffic: v.optional(v.float64()),
    music: v.optional(v.float64()),
    construction: v.optional(v.float64()),
    silence: v.optional(v.float64()),
    dominantClass: v.string(), // "birds" | "insects" | "rain" | "traffic" | "music" | "construction" | "silence"
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
    storageId: v.optional(v.id("_storage")), // Convex file storage reference
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
    elasticSynced: v.optional(v.boolean()),
    gifStorageId: v.optional(v.id("_storage")),
    videoStorageId: v.optional(v.id("_storage")),
    gifStatus: v.optional(v.string()), // "pending" | "generating" | "done" | "failed"
    videoStatus: v.optional(v.string()), // "pending" | "generating" | "done" | "failed"
    yamnetLabels: v.optional(
      v.array(v.object({ label: v.string(), score: v.float64() })),
    ),
  })
    .index("by_userId", ["userId"])
    .index("by_likeCount", ["likeCount"])
    .index("by_listenCount", ["listenCount"])
    .index("by_elasticSynced", ["elasticSynced"]),

  userLikes: defineTable({
    userId: v.string(),
    uploadId: v.id("uploads"),
  })
    .index("by_userId", ["userId"])
    .index("by_uploadId", ["uploadId"])
    .index("by_userId_uploadId", ["userId", "uploadId"]),
});
