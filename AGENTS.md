# AGENTS.md - Long-term Memory for AI Agents

This file contains architectural decisions, patterns, and gotchas discovered while working on this codebase. AI agents (including Ralph iterations) should read this before making changes.

## Tech Stack

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS + shadcn/ui components
- **Database**: PostgreSQL via Prisma ORM
- **Auth**: Supabase Auth
- **AI**: Anthropic Claude API

## Project Structure Patterns

- `src/app/(dashboard)/` - Protected routes requiring authentication
- `src/app/(auth)/` - Public authentication pages
- `src/app/api/` - API routes (Next.js Route Handlers)
- `src/components/ui/` - shadcn/ui components (don't modify directly)
- `src/lib/` - Shared utilities and integrations

## Database Patterns

- Always use Prisma client from `src/lib/prisma.ts`
- Run `npx prisma generate` after schema changes
- Use `npx prisma db push` for development migrations
- Multi-tenant: Most queries should filter by `workspaceId`

## API Route Patterns

- Use Zod schemas from `src/lib/types.ts` for validation
- Return consistent error shapes: `{ error: string }`
- Check authentication via Supabase session

## Component Patterns

- Use shadcn/ui components from `src/components/ui/`
- Follow existing patterns for loading states and error handling
- Client components need `"use client"` directive

## Quality Gates

Before committing, ensure:
1. `npm run build` passes (includes TypeScript check)
2. No ESLint errors: `npm run lint`
3. UI changes verified in browser at `http://localhost:3000`

## Gotchas

- Environment variables prefixed with `NEXT_PUBLIC_` are exposed to the browser
- Prisma client must be instantiated as a singleton (see `src/lib/prisma.ts`)
- API routes in App Router use `NextRequest`/`NextResponse`, not `req`/`res`

---

*Add new patterns and gotchas below as you discover them:*
