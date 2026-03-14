# Architecture

## Pattern
Full-stack TypeScript application with **clear frontend/backend separation**:
- **Frontend:** Next.js App Router with server-side rendering and client components
- **Backend:** Convex serverless platform (not Next.js API routes, except for auth proxy)
- **Auth:** Better Auth library bridging both layers via Convex component

## Layers

### 1. Next.js Frontend Layer
- **Server Components** handle initial auth checks, data preloading, and layout
- **Client Components** handle interactive UI, form state, auth client operations
- Auth boundary pattern: server layout checks `isAuthenticated()`, client wraps in `ClientAuthBoundary`

### 2. Auth Integration Layer
- `lib/auth-server.ts` - Server-side auth utilities (SSR token, preload queries)
- `lib/auth-client.tsx` - Client-side auth client + `AuthBoundary` component
- `app/api/auth/[...all]/route.ts` - Next.js catch-all route proxying to Better Auth
- `convex/auth.ts` - Better Auth server configuration with Convex adapter

### 3. Convex Backend Layer
- `convex/schema.ts` - Database schema (currently empty, auth tables auto-generated)
- `convex/auth.ts` - Auth functions (getCurrentUser, getUserById, rotateKeys)
- `convex/http.ts` - HTTP router for Better Auth endpoints
- `convex/email.tsx` - Email sending functions via Resend component
- `convex/betterAuth/` - Better Auth Convex component (schema, adapter, generated code)

## Data Flow

### Authentication Flow
```
User → Next.js Client → Better Auth Client SDK
  → Next.js API Route (/api/auth/[...all])
  → Convex HTTP Endpoint (via Better Auth)
  → Convex Database (user, session, account tables)
```

### Authenticated Page Load
```
Next.js Server Component
  → getToken() (from auth-server.ts, with JWT cache)
  → preloadAuthQuery() (preloads Convex query with auth token)
  → Pass preloaded data to Client Component
  → usePreloadedAuthQuery() (hydrate on client)
```

### Email Flow
```
Better Auth trigger (verification, reset, magic link)
  → convex/email.tsx helper function
  → @react-email/components renders JSX template
  → @convex-dev/resend sends via Resend API
```

## Entry Points
- `app/layout.tsx` - Root layout, initializes ConvexClientProvider with server token
- `app/page.tsx` - Landing page, redirects authenticated users to /dashboard
- `convex/http.ts` - Convex HTTP endpoint entry point
- `convex/convex.config.ts` - Convex app configuration (components)
- `app/api/auth/[...all]/route.ts` - Auth API proxy

## Route Groups
- `app/(auth)/` - Authenticated routes (dashboard, settings) - server-side auth guard + client auth boundary
- `app/(unauth)/` - Unauthenticated routes (sign-in, sign-up, verify-2fa) - redirects if already authenticated
- `app/reset-password/` - Password reset (outside route groups)

## Key Abstractions
- `ConvexClientProvider` - Wraps app with Convex + Better Auth providers
- `ClientAuthBoundary` - Client-side auth boundary that redirects to /sign-in on unauth
- `authComponent` - Convex Better Auth client for server-side auth operations
- `createAuth()` / `createAuthOptions()` - Factory for Better Auth instance with Convex adapter
