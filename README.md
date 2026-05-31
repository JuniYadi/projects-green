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
- `bun run test`: Run Bun test suite
- `bun run lint`: Run ESLint checks
- `bun run typecheck`: Run TypeScript compiler checks
- `bun run prisma:migrate:dev`: Apply database migrations
- `bun run grant:super-admin -- --workos-user-id=<id>`: Grant platform super-admin role
- `bun run seed:workos-roles`: Seed required WorkOS organization roles
- `bun run worker:github`: Start background GitHub webhook worker

## Route Access

- `/portal`: Accessible by Tenant `owner`, `admin`, and Platform `super_admin`
- `/console`: Accessible by Tenant `member` (and higher roles)

## Tech Stack

Next.js 16, TypeScript, Bun, shadcn/ui, Tailwind, Prisma, PostgreSQL, Redis, WorkOS.

## Documentation

Full documentation, PRDs, and task tracking are delegated to the IDE projects hub:
**[~/ide-projects/projects-green/](/home/juniyadi/ide-projects/projects-green/)**

- [GitHub App Integration Specification](docs/github-app-integration.md)
