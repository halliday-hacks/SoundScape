import { components } from "./_generated/api";
import { internalAction, query } from "./_generated/server";
import authSchema from "./betterAuth/schema";
import { createClient, GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import {
  genericOAuth,
  username,
} from "better-auth/plugins";
import { emailOTP } from "better-auth/plugins";
import {
  sendMagicLink,
  sendOTPVerification,
  sendEmailVerification,
  sendResetPassword,
} from "./email";
import { magicLink } from "better-auth/plugins";
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import { requireActionCtx } from "@convex-dev/better-auth/utils";
import { DataModel } from "./_generated/dataModel";
import { v } from "convex/values";
import authConfig from "./auth.config";

// This implementation uses Local Install as it would be in a new project.

const siteUrl = process.env.SITE_URL;

export const authComponent = createClient<DataModel, typeof authSchema>(
  components.betterAuth,
  {
    local: {
      schema: authSchema,
    },
    verbose: false,
  },
);

export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
  return {
    baseURL: siteUrl,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: siteUrl ? [siteUrl] : [],
    database: authComponent.adapter(ctx),
    // Rate limiting via "database" storage requires a rateLimit table that the
    // Convex Better Auth adapter doesn't include yet. Using "memory" as a
    // best-effort fallback — counters reset per function invocation on serverless,
    // so consider adding infrastructure-level rate limiting (e.g. Convex rate
    // limiter library) for stronger protection.
    rateLimit: {
      enabled: true,
      storage: "memory",
      window: 10,
      max: 100,
      customRules: {
        "/api/auth/sign-in/email": { window: 60, max: 5 },
        "/api/auth/sign-up/email": { window: 60, max: 3 },
        "/api/auth/change-password": { window: 60, max: 3 },
        "/api/auth/forget-password": { window: 60, max: 3 },
      },
    },
    account: {
      accountLinking: {
        enabled: true,
        allowDifferentEmails: false,
      },
      encryptOAuthTokens: true,
    },
    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmailVerification(requireActionCtx(ctx), {
          to: user.email,
          url,
        });
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }) => {
        await sendResetPassword(requireActionCtx(ctx), {
          to: user.email,
          url,
        });
      },
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID as string,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        accessType: "offline",
        prompt: "select_account consent",
      },
      ...(process.env.GITHUB_CLIENT_ID && {
        github: {
          clientId: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
        },
      }),
    },
    user: {
      additionalFields: {
        foo: {
          type: "string",
          required: false,
        },
      },
      deleteUser: {
        enabled: true,
      },
    },
    plugins: [
      username(),
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          await sendMagicLink(requireActionCtx(ctx), {
            to: email,
            url,
          });
        },
      }),
      emailOTP({
        async sendVerificationOTP({ email, otp }) {
          await sendOTPVerification(requireActionCtx(ctx), {
            to: email,
            code: otp,
          });
        },
      }),
      ...(process.env.SLACK_CLIENT_ID
        ? [
            genericOAuth({
              config: [
                {
                  providerId: "slack",
                  clientId: process.env.SLACK_CLIENT_ID,
                  clientSecret: process.env.SLACK_CLIENT_SECRET as string,
                  discoveryUrl:
                    "https://slack.com/.well-known/openid-configuration",
                  scopes: ["openid", "email", "profile"],
                },
              ],
            }),
          ]
        : []),
      convex({
        authConfig,
      }),
    ],
  } satisfies BetterAuthOptions;
};

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth(createAuthOptions(ctx));

export const { getAuthUser } = authComponent.clientApi();

export const rotateKeys = internalAction({
  args: {},
  handler: async (ctx) => {
    const auth = createAuth(ctx);
    await auth.api.rotateKeys();
  },
});

// Example functions, feel free to edit, omit, etc.

// Get the current user
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return authComponent.safeGetAuthUser(ctx);
  },
});

// Get a user by their Better Auth user id with Local Install
export const getUserById = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return ctx.runQuery(components.betterAuth.users.getUser, {
      userId: args.userId,
    });
  },
});
