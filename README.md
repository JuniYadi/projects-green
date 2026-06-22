# projects-green

Multi-tenant SaaS DevOps orchestration platform.

## Quick Start

```bash
# 1. Clone and enter
git clone https://github.com/JuniYadi/projects-green.git
cd projects-green

# 2. Setup environment
cp .env.example .env.local

# 3. Start infrastructure (Postgres + Redis)
docker compose up -d postgres redis

# 4. Install and start
bun install
bun run dev
```

## Key Scripts

- `bun run dev`: Start local development server
- `bun run build`: Production build
- `bun run test`: Run Bun test suite (excludes e2e tests)
- `bun run test:coverage`: Run tests with coverage report + threshold check
- `bun run lint`: Run ESLint checks
- `bun run typecheck`: Run TypeScript compiler checks
- `bun run prisma:migrate:dev`: Apply database migrations
- `bun run grant:super-admin -- --workos-user-id=<id>`: Grant platform super-admin role
- `bun run seed:workos-roles`: Seed required WorkOS organization roles
- `bun run worker:github`: Start background GitHub webhook worker

## Testing

### Local workflow
```bash
bun install            # Install dependencies
bun run test           # Run unit + component tests (CI-equivalent)
bun run lint           # ESLint — 0 errors required
bun run typecheck      # TypeScript — 0 errors required
```

### Coverage
Coverage enforced via `scripts/check-coverage-threshold.ts`:
- **Base threshold** (CI fail): functions ≥80%, lines ≥80%
- **Target** (warning): 90% — below this prints a warning, doesn't fail
- Checked by `bun run test:coverage` in CI (`coverage-codecov.yml`)
- Coverage runs in single-process mode (same as CI), which surfaces `mock.module` cross-file pollution missed by `bun test`

### Excluded from coverage
- `**/*.dto.ts` — DTO-only files (pure type mappings)
- `**/prisma/**` — Generated Prisma client
- `next.config.*` — Build configuration
- whatsapp/, e2e/, modules/deploy/ — excluded via script logic

### Mocking rules
See `AGENTS.md` for Bun `mock.module` rules — critical for CI where coverage runs in a single process and `mock.module` state persists across files.

## Route Access

- `/portal`: Accessible by Tenant `owner`, `admin`, and Platform `super_admin`
- `/console`: Accessible by Tenant `member` (and higher roles)

## Tech Stack

Next.js 16, TypeScript, Bun, shadcn/ui, Tailwind, Prisma, PostgreSQL, Redis, WorkOS.

## Documentation

Full documentation, PRDs, and task tracking are delegated to the IDE projects hub:
**[~/ide-projects/projects-green/](/home/juniyadi/ide-projects/projects-green/)**

- [GitHub App Integration Specification](docs/github-app-integration.md)
