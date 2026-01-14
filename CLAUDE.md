# CLAUDE.md - Instructions for Claude Code

This file provides context when Claude Code is working on this project, either interactively or via the Ralph autonomous loop.

## Quick Start Commands

```bash
# Development
npm run dev          # Start dev server at http://localhost:3000
npm run build        # Production build (includes typecheck)
npm run lint         # ESLint check

# Database
npx prisma generate  # Regenerate Prisma client
npx prisma db push   # Push schema changes
npx prisma studio    # Open database GUI

# Ralph (Autonomous Agent Loop)
./scripts/ralph/ralph.sh           # Run Ralph with defaults
./scripts/ralph/ralph.sh -v        # Verbose mode
./scripts/ralph/generate-prd.sh "Feature description"  # Generate PRD
```

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Login, signup pages
│   ├── (dashboard)/     # Protected app pages
│   └── api/             # API routes (Route Handlers)
├── components/
│   ├── ui/              # shadcn/ui components (don't edit directly)
│   └── ...              # Custom components
├── lib/
│   ├── prisma.ts        # Prisma client singleton
│   ├── types.ts         # Shared TypeScript types + Zod schemas
│   └── ...              # Utilities
prisma/
└── schema.prisma        # Database schema
scripts/
└── ralph/               # Autonomous agent loop
```

## Code Patterns

### API Routes (App Router)
```typescript
// src/app/api/example/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const data = await prisma.example.findMany()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
```

### Client Components
```typescript
// Must have "use client" for interactivity
"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function MyComponent() {
  const [loading, setLoading] = useState(false)
  // ...
}
```

### Server Components (default)
```typescript
// No "use client" - can use async/await directly
import { prisma } from '@/lib/prisma'

export default async function Page() {
  const data = await prisma.example.findMany()
  return <div>{/* render data */}</div>
}
```

## Common Gotchas

1. **Prisma client changes**: Always run `npx prisma generate` after modifying schema.prisma
2. **Environment variables**: Prefix with `NEXT_PUBLIC_` for client-side access
3. **shadcn/ui imports**: Import from `@/components/ui/`, not the package
4. **App Router**: Use `NextRequest`/`NextResponse`, not `req`/`res`
5. **Client vs Server**: Interactive components need `"use client"` directive

## When Using Ralph

Ralph runs Claude Code in autonomous iterations. Each iteration:
1. Reads `scripts/ralph/prd.json` for the current task list
2. Implements ONE user story
3. Runs quality checks (build, lint)
4. Commits and updates the PRD
5. Logs progress to `scripts/ralph/progress.txt`

Key files:
- `scripts/ralph/prd.json` - Task list (created from prd.json.example)
- `scripts/ralph/prompt.md` - Instructions for each iteration
- `scripts/ralph/progress.txt` - Append-only log
- `AGENTS.md` - Long-term architectural knowledge

## Testing Changes

Before committing:
```bash
npm run build    # Must pass
npm run lint     # Must pass
```

For UI changes, verify in browser at `http://localhost:3000`
