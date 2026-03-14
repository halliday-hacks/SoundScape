import { query } from "./_generated/server";
import { v } from "convex/values";

export const getAllUsers = query({
  args: {},
  handler: async (ctx) => {
    // Direct query to the BetterAuth 'user' table
    return await ctx.db.query("user").collect();
  },
});

export const getByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("user")
      .withIndex("username", (q) => q.eq("username", args.username))
      .unique();
  },
});
