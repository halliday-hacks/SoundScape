# Code Conventions

## TypeScript
- **Strict mode** enabled
- `@typescript-eslint/no-explicit-any` is turned **off**
- Path alias `@/*` for project root imports
- `satisfies` operator used for type-safe config objects (e.g., `satisfies BetterAuthOptions`, `satisfies AuthConfig`)
- Generic types used for Convex data models: `Id<"tableName">`, `Doc<"tableName">`

## React Patterns

### Component Organization
- **Server Components** are the default (no directive needed)
- **Client Components** marked with `"use client"` at top of file
- Page components use `async` for server-side data fetching
- Client components handle all interactive state and form logic

### State Management
- `useState` for local component state (no global state library)
- Convex `useQuery` / `usePreloadedAuthQuery` for server state
- `Preloaded<>` type for server-to-client query preloading

### Auth Pattern
- Server layouts check auth with `isAuthenticated()` and `redirect()`
- Client components use `authClient` from `lib/auth-client.tsx`
- Better Auth callbacks pattern: `{ onRequest, onSuccess, onError }`

### Form Handling
- Direct `useState` for form fields (not react-hook-form in current pages, though it's installed)
- Form submission via `onSubmit` with `e.preventDefault()`
- Loading states tracked per-action with individual boolean states

## Convex Patterns
- Functions use new syntax with `args` and `returns` validators (though `returns` often omitted)
- `createClient()` for component-level auth client
- `authComponent.adapter(ctx)` for database adapter
- `requireActionCtx()` utility for type-safe action context
- HTTP routes registered via `authComponent.registerRoutes()`
- Polyfills imported at top of `http.ts` for V8 runtime compatibility

## Styling
- Tailwind CSS v4 utility classes throughout
- Dark mode hardcoded (`className="dark"` on html element)
- `cn()` utility (clsx + tailwind-merge) for conditional classes
- shadcn/ui components used for all UI primitives
- Color palette: neutral-950 bg, neutral-50 text, orange accents

## Error Handling
- `alert()` used for user-facing error messages (starter-level UX)
- `toast.error()` via sonner in sign-up flow
- `console.error()` for debug logging
- `ConvexError` checked in `isAuthError()` utility
- Try/catch blocks around auth operations

## Import Style
- Named imports preferred
- Path aliases (`@/`) for cross-directory imports
- Relative imports within same directory
- Type imports: `import type { ... }` used occasionally

## Code Style
- Prettier for formatting (minimal config)
- ESLint with Next.js recommended rules
- Arrow functions for component definitions and handlers
- Destructured props
- `PropsWithChildren` type for layout components
