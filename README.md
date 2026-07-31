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
## Database & Seed Data

### Dumping seed data

Before resetting the database, dump your live data so it can be restored afterward:

```bash
bun run dump:seeds              # dumps all tables with data → prisma/seeds/*.sql
bun run dump:seeds --tables=User,Organization  # dump specific tables only
bun run dump:seeds --concurrency=25           # increase parallelism (default: 8)
```

Only tables with rows are written — empty tables are skipped automatically.
The SQL files use `INSERT ... ON CONFLICT DO NOTHING`, so restores are idempotent.

### Database reset (interactive)

```bash
bun run db:reset               # interactive — will prompt before each step
bun run db:reset --yes        # non-interactive (skips confirmation prompt, restore still runs)

`db:reset` runs through all steps, including seed restore. Use `--yes` to skip
interactive confirmation prompts (restore:seeds still runs automatically).
1. **Drop & recreate DB** — destroys all data
2. **Regenerate migrations?** — say `y` if migration history is broken (removes `prisma/migrations`, runs `migrate dev`)
3. **Run migrations?** — applies existing migrations via `migrate deploy`
4. **Generate Prisma client**
5. **Restore seeds** — replays `prisma/seeds/*.sql`
6. **Run system seeders?** — currencies, billing plans, etc.

### Just drop the database

```bash
bun run db:drop                # drops the database immediately, no prompts
```

Use this when you want to manually fix migrations before running `db:reset`.

### Individual seed operations

| Command | What it does |
|---|---|
| `bun run restore:seeds` | Replay `prisma/seeds/*.sql` via `SqlRestoreSeeder` |
| `bun run seed:system` | Run all system seeders (currencies, billing plans, etc.) |
| `bun run seed:dummy` | Run dummy seeders (test orgs, fake invoices, etc.) |
| `bun run seed:all` | Run all seeders (system + dummy) |

### Manual workflow (step-by-step)

```bash
# 1. Dump live data before touching anything
bun run dump:seeds

# 2. Just drop — fix migrations manually if needed
bun run db:drop

# 3. Reset with interactive prompts
bun run db:reset

# Or: run each step manually
# bun --bun prisma migrate dev   # regenerate migrations if needed
# bun --bun prisma migrate deploy  # apply migrations
# bun --bun prisma generate
# bun run restore:seeds
# bun run seed:system
```

### Seed file overview

| File | Purpose |
|---|---|
| `prisma/seeds/manifest.ts` | List of tables to dump/restore, in FK-safe order |
| `prisma/seeds/*.sql` | Dumped data (gitignored — local only) |
| `lib/seeders/system/sql-restore.seeder.ts` | Seeder that replays `.sql` files |
| `lib/seeders/system/` | Other system seeders (billing, currency, etc.) |
| `lib/seeders/dummy/` | Dev-only seeders with fake/test data |
| `scripts/db-reset.ts` | Interactive DB reset workflow |
| `scripts/db-drop.ts` | Just drop the database |
| `scripts/dump-seed-data.ts` | Dump live data to `.sql` files |

**Gitignore:** `prisma/seeds/*.sql` are local-only and not committed.


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
