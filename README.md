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
- `bun run test`: Run deterministic `*.test.ts` logic tests
- `bun run test:changed`: Run changed logic tests and feature dependents
- `bun run test:component`: Run nightly `*.test.tsx` component tests
- `bun run test:functional`: Run affected Playwright smoke flows
- `bun run test:coverage:changed`: Cover changed-feature logic locally
- `bun run test:coverage`: Run complete logic coverage (merge queue/manual)
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
bun run test:changed   # Fast logic feedback for the current diff
bun run test:coverage:changed # Enforce 85% on changed logic
bun run lint           # ESLint — 0 errors required
bun run typecheck      # TypeScript — 0 errors required
```

The pull request gate uses the two changed-logic commands above and the
affected Playwright smoke project. The complete logic coverage gate runs in
GitHub's merge queue. Component and deterministic legacy browser suites run
nightly, outside the pull request critical path.

### Coverage
Coverage is logic-only and enforced by Bun and Codecov:

- Project line coverage: at least 85%
- Project function coverage: at least 85%
- Codecov patch coverage: at least 85%, with no threshold leniency
- `.tsx` presentation code is excluded from coverage
- Executable DTO mappers remain eligible
- LCOV is uploaded intact under the single `logic` flag
- Changed-only LCOV is not uploaded as project coverage

### Excluded from coverage
- `**/*.tsx` — Presentation and component rendering
- `**/*.test.ts(x)`, declarations, fixtures, and generated output
- `**/prisma/**` — Generated Prisma client
- Configuration files and the reviewed external-adapter exemptions in
  `scripts/test-suites.ts`

### Mocking rules
See `AGENTS.md` for Bun `mock.module` rules. Full component and browser suites
run nightly or by manual dispatch; small affected-feature Playwright smoke
flows are the automated UI gate for pull requests.

## Route Access

- `/portal`: Accessible by Tenant `owner`, `admin`, and Platform `super_admin`
- `/console`: Accessible by Tenant `member` (and higher roles)

## Tech Stack

Next.js 16, TypeScript, Bun, shadcn/ui, Tailwind, Prisma, PostgreSQL, Redis, WorkOS.

## Documentation

Full documentation, PRDs, and task tracking are delegated to the IDE projects hub:
**[~/ide-projects/projects-green/](/home/juniyadi/ide-projects/projects-green/)**

- [GitHub App Integration Specification](docs/github-app-integration.md)
