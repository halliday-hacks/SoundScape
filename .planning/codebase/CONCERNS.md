# Concerns & Technical Debt

## High Priority

### 1. Dead Code / Broken Feature: Disable 2FA
**File:** `app/(auth)/settings/page.tsx:26`
```typescript
throw new Error("Not implemented");
```
The `handleDisable2FA` function throws immediately, making the "Disable 2FA" button non-functional. The code after the throw is unreachable.

### 2. Empty App Schema
**File:** `convex/schema.ts`
The app schema is empty (`defineSchema({})`). All tables come from the Better Auth component. Any app-specific data will need schema additions here.

### 3. Hardcoded Email Sender
**File:** `convex/email.tsx`
All emails use `from: "Test <onboarding@boboddy.business>"` - a placeholder that needs to be configured per-deployment.

## Medium Priority

### 4. Alert-Based Error UX
Multiple files use `alert()` for error messages instead of proper toast notifications. Only the sign-up flow uses `sonner` toast. This creates an inconsistent and poor user experience.
- `app/(auth)/settings/page.tsx` - 2 alert() calls
- `app/(auth)/settings/EnableTwoFactor.tsx` - 3 alert() calls
- `app/(unauth)/sign-in/SignIn.tsx` - 5 alert() calls
- `app/(unauth)/verify-2fa/TwoFactorVerification.tsx` - 3 alert() calls

### 5. Commented-Out OAuth Buttons
**File:** `app/(unauth)/sign-in/SignIn.tsx:374-435`
GitHub and Slack sign-in buttons are commented out. The handlers exist but UI is hidden. Should be cleaned up or made conditional based on env vars.

### 6. No CSRF / Rate Limiting
No rate limiting or CSRF protection configured beyond Better Auth defaults. The auth config doesn't set up any explicit security middleware.

### 7. react-hook-form Installed But Unused
`react-hook-form` and `@hookform/resolvers` are installed as dependencies, and shadcn/ui `form.tsx` component exists, but all current forms use raw `useState`. Either adopt it or remove the dependency.

### 8. next-themes Installed But Unused
`next-themes` is installed but the app hardcodes `className="dark"` on the `<html>` element. Theme switching is not implemented.

## Low Priority

### 9. No Loading/Error States for Layouts
Route group layouts (`(auth)/layout.tsx`, `(unauth)/layout.tsx`) don't have loading or error boundaries. Auth checks could leave users with blank screens during transitions.

### 10. No `loading.tsx` or `error.tsx` Pages
No Next.js loading or error boundary pages exist for any route.

### 11. Anonymous Sign-In Handler Exists But No UI
**File:** `app/(unauth)/sign-in/SignIn.tsx:74-91`
`handleAnonymousSignIn` is defined but never called from any UI element.

### 12. Unused shadcn/ui Components
~55 shadcn/ui components installed but most are unused. Only ~10 are actively used (button, card, input, label, checkbox, dialog, form). This adds to bundle size if not tree-shaken.

### 13. `reactStrictMode: false`
**File:** `next.config.ts`
React strict mode is disabled. This can mask bugs during development that would be caught by double-rendering in strict mode.

### 14. Image Handling
**File:** `app/(unauth)/sign-up/SignUp.tsx`
Profile images are converted to base64 and stored as strings. For production, file storage (Convex file storage or external CDN) would be more appropriate.

### 15. Missing `convex.json` Content Verification
The `convex.json` file exists but its content wasn't verified for proper project/deployment configuration.

## Security Notes
- `.env.local` is gitignored (confirmed in `.gitignore`)
- OAuth secrets properly accessed via `process.env` server-side
- Conditional OAuth provider setup prevents errors when credentials are missing
- Account linking enabled with `allowDifferentEmails: true` - potential security consideration depending on use case
