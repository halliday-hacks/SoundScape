# Project: Hackathon Starter

Convex + Better Auth + Next.js hackathon starter app.

## Stack

- **Framework:** Next.js 16 (App Router, React 19)
- **Backend:** Convex (real-time database, serverless functions)
- **Auth:** Better Auth via `@convex-dev/better-auth`
- **Styling:** Tailwind CSS v4, shadcn/ui
- **Language:** TypeScript (strict mode)

## Project Structure

```
app/           → Next.js app router pages and layouts
components/    → React UI components (shadcn/ui)
convex/        → Convex backend (schema, functions, auth, http)
lib/           → Shared utilities and client config
public/        → Static assets
```

## Convex Guidelines

### Function Syntax

Always use the new function syntax with argument and return validators:

```typescript
import { query } from "./_generated/server";
import { v } from "convex/values";

export const f = query({
  args: { name: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    return "Hello " + args.name;
  },
});
```

If a function doesn't return anything, use `returns: v.null()`.

### Public vs Internal Functions

- `query`, `mutation`, `action` → public API, exposed to the internet
- `internalQuery`, `internalMutation`, `internalAction` → private, only callable by other Convex functions
- Do NOT use public registrations for sensitive internal logic

### Function References

- Use `api.file.functionName` for public functions
- Use `internal.file.functionName` for internal functions
- Convex uses file-based routing: `convex/todos.ts` → `api.todos.functionName`

### Queries

- Do NOT use `.filter()` — define an index and use `.withIndex()` instead
- Use `.order("asc")` or `.order("desc")` for ordering (defaults to ascending `_creationTime`)
- Use `.unique()` for single document retrieval
- Convex queries do NOT support `.delete()` — collect results and call `ctx.db.delete(row._id)` on each

### Mutations

- `ctx.db.patch(id, fields)` → shallow merge update
- `ctx.db.replace(id, fields)` → full document replacement

### Actions

- Add `"use node";` at the top of files using Node.js built-in modules
- Actions do NOT have `ctx.db` access — use `ctx.runQuery`/`ctx.runMutation` instead
- Only call an action from another action if crossing runtimes (V8 ↔ Node)

### Schema

- Define schema in `convex/schema.ts`
- System fields `_id` and `_creationTime` are auto-added
- Include all index fields in index names (e.g., `"by_field1_and_field2"`)
- Index fields must be queried in definition order

### Validators

- `v.bigint()` is deprecated — use `v.int64()`
- Use `v.record(keys, values)` for records; `v.map()` and `v.set()` are not supported
- Use `v.null()` for null return values
- JavaScript `undefined` is not a valid Convex value — use `null`

### TypeScript

- Use `Id<"tableName">` for document ID types (from `./_generated/dataModel`)
- Use `Doc<"tableName">` for full document types
- Be strict with ID types — prefer `Id<"users">` over `string`
- Add `@types/node` when using Node.js built-in modules

### HTTP Endpoints

Define in `convex/http.ts`:

```typescript
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

const http = httpRouter();
http.route({
  path: "/api/route",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const body = await req.bytes();
    return new Response(body, { status: 200 });
  }),
});
export default http;
```

### Scheduling & Crons

- Use `crons.interval` or `crons.cron` only (not `.hourly`, `.daily`, `.weekly`)
- Pass function references, not functions directly
- Define in `convex/crons.ts`, export `crons` as default

### File Storage

- Use `ctx.storage.getUrl()` for signed URLs (returns `null` if file doesn't exist)
- Query `_storage` system table for metadata (not deprecated `ctx.storage.getMetadata`)
- Store/retrieve items as `Blob` objects

## Dev Commands

```bash
bun run dev          # Start frontend + backend concurrently
bun run lint         # ESLint + TypeScript checks
```

## Installed Agent Skills

Skills live in `.agents/skills/` and are symlinked into each agent's config directory
(e.g., `.claude/skills/`, `.cursor/rules/`). All agents on this project share the same skills.

| Skill | Source | Purpose |
|-------|--------|---------|
| `convex` | waynesutton/convexskills | Convex development patterns, schema design, queries, mutations |
| `better-auth-best-practices` | better-auth/skills | Better Auth integration patterns for TypeScript apps |
| `better-auth-security-best-practices` | better-auth/skills | Rate limiting, CSRF, session security, OAuth security |
| `shadcn-ui` | jezweb/claude-skills | shadcn/ui component patterns and Tailwind v4 integration |
| `vercel-react-best-practices` | vercel-labs/agent-skills | React/Next.js performance optimization from Vercel Engineering |

To add more skills: `npx skills find <query>` then `npx skills add <package> -y`

## Conventions

- Keep Convex functions focused — one concern per function
- Prefer indexes over filters for all database queries
- Minimize action-to-query/mutation calls (each is a separate transaction)
- Use `ctx.scheduler.runAfter(0, ...)` for fire-and-forget background work
