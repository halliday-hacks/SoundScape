# Technology Stack

## Languages & Runtime
- **TypeScript** (strict mode) - primary language for both frontend and backend
- **Target:** ES2017
- **Runtime:** Node.js (Next.js server), Convex V8 runtime (backend functions)
- **Package manager:** Bun (bun.lock, `bun run` scripts)

## Frontend Framework
- **Next.js 16** (App Router, React 19)
  - `reactStrictMode: false` in config
  - Server Components used in layouts and pages
  - Client Components marked with `"use client"` directive
  - Path aliases: `@/*` maps to project root

## Backend / Database
- **Convex** (`^1.33.0`) - real-time serverless database and functions
  - Component architecture via `defineApp()` + `app.use()`
  - Two components installed: `betterAuth`, `resend`
  - Schema defined in `convex/schema.ts` (currently empty custom schema)
  - Better Auth schema auto-generated in `convex/betterAuth/`

## Authentication
- **Better Auth** (`^1.5.5`) via `@convex-dev/better-auth` (`^0.11.1`)
  - Email/password with email verification
  - Social providers: Google (configured), GitHub (conditional), Slack (conditional via genericOAuth)
  - Plugins: `username`, `magicLink`, `emailOTP`, `twoFactor`, `convex`
  - JWT-based session with experimental `jwtCache`
  - Next.js integration via `convexBetterAuthNextJs()`

## Styling
- **Tailwind CSS v4** (`^4.0.17`) with PostCSS plugin
- **shadcn/ui** (`^2.4.0-canary.17`) - comprehensive UI component library (55+ components)
- **tw-animate-css** for animations
- **Dark mode** - hardcoded `className="dark"` on `<html>`

## Key Libraries
| Library | Version | Purpose |
|---------|---------|---------|
| `convex-helpers` | `^0.1.87` | Convex utility functions (validators, doc helpers) |
| `react-hook-form` + `@hookform/resolvers` | `^7.71.2` | Form handling |
| `zod` | `^4.3.6` | Schema validation |
| `jose` | `^6.1.2` | JWT handling |
| `resend` + `@convex-dev/resend` | `^4.2.0` / `^0.1.4` | Transactional email |
| `@react-email/components` | `0.5.0` | Email templates (JSX) |
| `react-qr-code` | `^2.0.15` | QR codes for 2FA TOTP |
| `sonner` | `^2.0.7` | Toast notifications |
| `lucide-react` | `^0.577.0` | Icons |
| `recharts` | `2.15.4` | Charts |
| `date-fns` | `^4.1.0` | Date utilities |
| `next-themes` | `^0.4.6` | Theme switching (installed but not actively used) |

## Dev Dependencies
| Library | Purpose |
|---------|---------|
| `concurrently` | Run frontend + backend dev servers simultaneously |
| `eslint` + `eslint-config-next` | Linting (next/core-web-vitals, next/typescript) |
| `prettier` | Code formatting |
| `typescript` | `^5` |

## Build & Dev Scripts
```
bun run dev          # concurrently runs Next.js + Convex dev
bun run dev:frontend # next dev
bun run dev:backend  # convex dev --typecheck-components
bun run build        # next build
bun run lint         # next lint && tsc -p convex && eslint convex
```

## Configuration Files
- `tsconfig.json` - strict mode, bundler resolution, incremental builds
- `eslint.config.mjs` - flat config, `@typescript-eslint/no-explicit-any: off`
- `postcss.config.mjs` - Tailwind CSS v4 PostCSS plugin
- `convex.json` - Convex project config
- `components.json` - shadcn/ui config
- `.prettierrc` - minimal config
