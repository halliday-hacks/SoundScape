# External Integrations

## Convex (Backend-as-a-Service)
- **Role:** Primary database, serverless functions, real-time subscriptions
- **Config:** `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`
- **Components:** betterAuth (auth storage), resend (email sending)
- **HTTP routes:** Registered via `convex/http.ts` for Better Auth endpoints
- **Client:** `ConvexReactClient` initialized in `ConvexClientProvider.tsx`

## Better Auth (Authentication)
- **Role:** Full auth system - sign-up, sign-in, session management, 2FA
- **Server config:** `convex/auth.ts` - creates auth options with Convex adapter
- **Client config:** `lib/auth-client.tsx` - `createAuthClient()` with plugins
- **Server helpers:** `lib/auth-server.ts` - `convexBetterAuthNextJs()` for SSR
- **Next.js API route:** `app/api/auth/[...all]/route.ts` - proxies auth requests
- **Auth config:** `convex/auth.config.ts` - Convex auth provider integration

### Auth Methods Configured
1. Email/password (with email verification required)
2. Google OAuth (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
3. GitHub OAuth (conditional - `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`)
4. Slack OAuth (conditional - `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` via genericOAuth)
5. Magic link (via email)
6. Email OTP (via email)
7. TOTP 2FA (via authenticator app)
8. Account linking enabled (allows different emails)

## Resend (Email)
- **Role:** Transactional email delivery
- **Integration:** `@convex-dev/resend` component in Convex
- **Config:** API key via Convex environment variables
- **Email templates:** JSX-based via `@react-email/components` in `convex/emails/`
  - `verifyEmail.tsx` - email verification
  - `magicLink.tsx` - magic link sign-in
  - `verifyOTP.tsx` - OTP verification codes
  - `resetPassword.tsx` - password reset
- **Sender:** `Test <onboarding@boboddy.business>` (placeholder)

## Environment Variables
| Variable | Required | Purpose |
|----------|----------|---------|
| `CONVEX_DEPLOYMENT` | Yes | Convex project deployment |
| `NEXT_PUBLIC_CONVEX_URL` | Yes | Convex client URL |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Yes | Convex HTTP endpoint URL |
| `NEXT_PUBLIC_SITE_URL` | Yes | Frontend URL (for redirects) |
| `SITE_URL` | Yes | Server-side site URL (for auth) |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth |
| `GITHUB_CLIENT_ID` | No | GitHub OAuth (conditional) |
| `GITHUB_CLIENT_SECRET` | No | GitHub OAuth (conditional) |
| `SLACK_CLIENT_ID` | No | Slack OAuth (conditional) |
| `SLACK_CLIENT_SECRET` | No | Slack OAuth (conditional) |
