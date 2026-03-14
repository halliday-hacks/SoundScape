# Testing

## Current State
**No testing infrastructure is set up.** This is a hackathon starter template focused on rapid development.

## What's Missing
- No test framework installed (no Jest, Vitest, Playwright, or Cypress)
- No test files in the codebase
- No test scripts in package.json
- No test configuration files
- No CI/CD pipeline

## Available Quality Checks
- `bun run lint` - ESLint + TypeScript type checking
  - `next lint` - Next.js ESLint rules (core-web-vitals + typescript)
  - `tsc -p convex` - TypeScript checking for Convex functions
  - `eslint convex` - ESLint for Convex directory

## Recommendations for Adding Tests
- **Unit tests:** Vitest (aligns with Bun/ESM ecosystem)
- **Component tests:** React Testing Library
- **E2E tests:** Playwright
- **Convex function tests:** Convex test framework (`convex-test`)
