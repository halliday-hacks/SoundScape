import { query } from "./_generated/server";
import { v } from "convex/values";
import { components } from "./_generated/api";

export const getAllUsers = query({
  args: {},
  handler: async (ctx) => {
    // Call the component's query using ctx.runQuery
    return await ctx.runQuery(components.betterAuth.users.getAllUsers);
  },
});

export const getByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.betterAuth.users.getByUsername, {
      username: args.username,
    });
  },
});
