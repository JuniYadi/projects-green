---
name: elysia-api-required
description: "All API endpoints must use ElysiaJS rather than native Next.js route handlers"
condition: "import\\s+.*\\b(?:NextRequest|NextResponse)\\b.*from\\s+['\"]next/server['\"]"
scope: ["tool:write(app/api/**/route.ts)", "tool:edit(app/api/**/route.ts)"]
---

All API endpoints in this repository must be built with ElysiaJS. Do not create raw Next.js route handlers using `NextRequest` or `NextResponse` from `next/server`. Implement routes through an Elysia router instance and export handlers via `app.handle`.
