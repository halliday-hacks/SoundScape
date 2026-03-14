# Project Structure

## Directory Layout

```
hackathon-starter/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (ConvexClientProvider, auth token)
│   ├── page.tsx                  # Landing page (redirects if authenticated)
│   ├── ConvexClientProvider.tsx  # Convex + Better Auth client provider
│   ├── globals.css               # Global styles (Tailwind v4)
│   ├── (auth)/                   # Authenticated route group
│   │   ├── layout.tsx            # Auth guard + ClientAuthBoundary
│   │   ├── dashboard/
│   │   │   ├── page.tsx          # Dashboard (server preloads user)
│   │   │   └── header.tsx        # User profile + sign out
│   │   └── settings/
│   │       ├── page.tsx          # Settings (2FA, delete account)
│   │       └── EnableTwoFactor.tsx  # 2FA setup wizard
│   ├── (unauth)/                 # Unauthenticated route group
│   │   ├── layout.tsx            # Redirects if authenticated
│   │   ├── sign-in/
│   │   │   ├── page.tsx          # Sign-in page wrapper
│   │   │   └── SignIn.tsx        # Sign-in form (email/pw, magic link, OTP, social)
│   │   ├── sign-up/
│   │   │   ├── page.tsx          # Sign-up page wrapper
│   │   │   └── SignUp.tsx        # Sign-up form
│   │   └── verify-2fa/
│   │       ├── page.tsx          # 2FA verification page wrapper
│   │       └── TwoFactorVerification.tsx  # 2FA verify (TOTP, OTP, backup)
│   ├── reset-password/
│   │   ├── page.tsx              # Password reset page
│   │   └── reset-password.tsx    # Reset password form
│   └── api/auth/[...all]/
│       └── route.ts              # Better Auth API proxy
├── components/
│   └── ui/                       # shadcn/ui components (~55 components)
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── ... (50+ more)
│       └── sidebar.tsx
├── convex/                       # Convex backend
│   ├── _generated/               # Auto-generated (API, types, server)
│   ├── betterAuth/               # Better Auth Convex component
│   │   ├── _generated/           # Component auto-generated files
│   │   ├── adapter.ts            # Convex database adapter
│   │   ├── auth.ts               # Static auth instance for schema gen
│   │   ├── convex.config.ts      # Component definition
│   │   ├── generatedSchema.ts    # Auto-generated auth tables
│   │   ├── schema.ts             # Auth schema with custom index
│   │   └── users.ts              # In-component user query
│   ├── emails/                   # React Email templates
│   │   ├── components/
│   │   │   └── BaseEmail.tsx     # Shared email layout
│   │   ├── magicLink.tsx
│   │   ├── resetPassword.tsx
│   │   ├── verifyEmail.tsx
│   │   └── verifyOTP.tsx
│   ├── auth.config.ts            # Convex auth config (provider)
│   ├── auth.ts                   # Better Auth server config + queries
│   ├── convex.config.ts          # App config (components: betterAuth, resend)
│   ├── email.tsx                 # Email sending functions
│   ├── http.ts                   # HTTP router (auth routes)
│   ├── polyfills.ts              # MessageChannel polyfill for Convex V8
│   └── schema.ts                 # App schema (empty, auth is separate)
├── hooks/
│   └── use-mobile.ts             # Mobile detection hook
├── lib/
│   ├── auth-client.tsx           # Better Auth client + AuthBoundary
│   ├── auth-server.ts            # Server-side auth utilities
│   └── utils.ts                  # cn() helper + isAuthError()
├── public/                       # Static assets
├── .env.example                  # Environment variable template
├── .env.local                    # Local environment variables (gitignored)
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
├── next.config.ts                # Next.js configuration
├── eslint.config.mjs             # ESLint flat config
├── postcss.config.mjs            # PostCSS (Tailwind v4)
├── convex.json                   # Convex project config
├── components.json               # shadcn/ui config
└── proxy.ts                      # Dev proxy script
```

## Key Locations
| What | Where |
|------|-------|
| App pages | `app/` (route groups: `(auth)`, `(unauth)`) |
| UI components | `components/ui/` (shadcn/ui) |
| Backend functions | `convex/` |
| Auth config (server) | `convex/auth.ts` |
| Auth config (client) | `lib/auth-client.tsx` |
| Auth config (SSR) | `lib/auth-server.ts` |
| Database schema | `convex/schema.ts` + `convex/betterAuth/schema.ts` |
| Email templates | `convex/emails/` |
| Shared utilities | `lib/utils.ts` |
| Custom hooks | `hooks/` |

## Naming Conventions
- **Pages:** `page.tsx` (Next.js convention)
- **Layouts:** `layout.tsx` (Next.js convention)
- **Client components:** PascalCase filenames (e.g., `SignIn.tsx`, `EnableTwoFactor.tsx`)
- **Hooks:** `use-kebab-case.ts`
- **Utilities:** `kebab-case.ts`
- **Convex functions:** camelCase exports
- **UI components:** kebab-case filenames in `components/ui/`

## File Count Summary
- App pages/components: ~18 files
- shadcn/ui components: ~55 files
- Convex backend: ~15 files (excluding generated)
- Library/utilities: 3 files
- Hooks: 1 file
