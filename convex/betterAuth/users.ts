import { query } from "./_generated/server";
import { doc } from "convex-helpers/validators";
import schema from "./schema";
import { v } from "convex/values";

// Get user by ID
export const getUser = query({
  args: { userId: v.id("user") },
  returns: v.union(v.null(), doc(schema, "user")),
  handler: async (ctx, args) => {
    return ctx.db.get(args.userId);
  },
});

// Get user by username (for profile pages)
export const getByUsername = query({
  args: { username: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("user"),
      name: v.string(),
      email: v.string(),
      image: v.optional(v.union(v.null(), v.string())),
      username: v.optional(v.union(v.null(), v.string())),
      displayUsername: v.optional(v.union(v.null(), v.string())),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("user")
      .withIndex("username", (q) => q.eq("username", args.username))
      .unique();

    if (!user) return null;

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      image: user.image,
      username: user.username,
      displayUsername: user.displayUsername,
      createdAt: user.createdAt,
    };
  },
});

// Get all users (for leaderboard)
export const getAllUsers = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("user"),
      name: v.string(),
      image: v.optional(v.union(v.null(), v.string())),
      username: v.optional(v.union(v.null(), v.string())),
    })
  ),
  handler: async (ctx) => {
    const users = await ctx.db.query("user").collect();
    return users.map((u) => ({
      _id: u._id,
      name: u.name,
      image: u.image,
      username: u.username,
    }));
  },
});
