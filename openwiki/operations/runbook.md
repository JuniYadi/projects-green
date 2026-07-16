# Operations & Runbook

## Development Quick Start

```bash
# 1. Start infrastructure
docker compose -f docker-compose.db.yml up -d

# 2. Install dependencies
bun install

# 3. Setup environment
cp .env.example .env.local

# 4. Apply database migrations
bun run db:migrate:dev

# 5. Start dev server (Turbopack, port 3300)
bun run dev
```

## Environment Variables

See `.env.example` for complete list. Key groups:

### Required
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `WORKOS_CLIENT_ID` | WorkOS AuthKit client ID |
| `WORKOS_API_KEY` | WorkOS API key (sk_...) |
| `WORKOS_COOKIE_PASSWORD` | Cookie encryption (32+ chars) |
| `ENCRYPTION_KEY` | 32-byte hex key for encryption |
| `JWT_SECRET` | HS256 JWT signer |

### WhatsApp
| Variable | Description |
|----------|-------------|
| `WHATSAPP_*` | WhatsApp Business API credentials |
| `META_*` | Meta platform tokens |

### Email
| Variable | Description |
|----------|-------------|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | SMTP credentials |
| `EMAIL_FROM` | Sender address (must not be `yourapp.com` in production) |

### Feature Flags
| Variable | Default | Description |
|----------|---------|-------------|
| `FEATURE_GITHUB_APP_INTEGRATION` | `false` | Enable GitHub App integration |

## Key Commands

### Development
```bash
bun run dev          # Start dev server (http://localhost:3300)
bun run tinker       # Interactive Prisma REPL (like artisan tinker)
bun run worker:all   # Start all background workers
```

### Database
```bash
bun run db:generate         # Regenerate Prisma client
bun run db:migrate:dev      # Apply dev migrations
bun run db:migrate:deploy   # Apply production migrations
bun run db:studio           # Open Prisma Studio
bun run db:status           # Check migration status
```

### Testing
```bash
bun run test               # Run unit + component tests (CI-equivalent)
bun run test:coverage      # Run with coverage + threshold check
bun run lint               # ESLint — 0 errors required
bun run typecheck          # TypeScript — 0 errors required
bun run test:e2e           # Playwright e2e tests
bun run test:e2e:ui        # Playwright with UI mode
```

### Seeds
```bash
bun run seed:all           # Seed everything
bun run seed:system        # System seed only
bun run seed:dummy         # Dummy test data
bun run seed:workos-roles  # Seed WorkOS org roles
```

### Admin
```bash
bun run bootstrap:super-admin         # Create initial super admin
bun run admin:role                    # Role management
bun run create:api-key                # API key creation
```

### Workers (individual)
```bash
bun run worker:github                # GitHub events worker
bun run worker:billing               # Billing cron jobs
bun run worker:whatsapp-billing      # WhatsApp monthly billing
bun run worker:deploy-monitor        # Deploy monitoring
bun run worker:vpn-renewal           # VPN subscription renewal
bun run worker:opensearch-ingest     # OpenSearch log ingestion
```

## Testing Guidelines

### "3 Pillars" (PR requirement)
1. `bun run lint` — 0 errors
2. `bun run typecheck` — 0 errors
3. `bun run test` — all tests pass

**Do NOT run these during local development** — only when opening a PR. Per `AGENTS.md`.

### Coverage Policy
- **Base threshold** (CI fail): functions ≥80%, lines ≥80%
- **Target** (warning): 90% — below this prints a warning, doesn't fail
- Checked by `bun run test:coverage` in CI (`coverage-codecov.yml`)
- Coverage runs in single-process mode (same as CI), which surfaces `mock.module` cross-file pollution missed by `bun test`

### Coverage Exclusions
- `**/*.dto.ts` — DTO-only files
- `**/prisma/**` — Generated Prisma client
- `next.config.*` — Build configuration
- `whatsapp/`, `e2e/`, `modules/deploy/` — excluded via script logic

### Mocking Rules
Bun's `mock.module` persists across files in single-process mode (CI coverage runs). Be careful with cross-file state pollution. See `AGENTS.md` for detailed rules.

### Test Patterns
- Tests co-located with source files: `*.test.ts` / `*.test.tsx`
- Global setup: `test/setup.ts` (preloaded via `bunfig.toml`)
- UI tests: Testing Library + Happy DOM
- E2E: Playwright with per-project auth fixtures

## CI/CD Pipeline

### GitHub Actions Workflows

| Workflow | File | Trigger |
|----------|------|---------|
| **Agent Orchestrator** | `agent-orchestrator.yml` | PR events — runs AI agent for code review/test/fix |
| **Claude PR Review** | `claude-pr-review.yml` | PR review with approve/request-changes verdict |
| **Coverage + Codecov** | `coverage-codecov.yml` | PR + push — test with coverage, upload to Codecov |
| **Typecheck + Build** | `typecheck-build.yml` | PR + push — TypeScript check and build |
| **Docker Publish** | `docker-publish.yml` | Push to main — publish Docker images |
| **OpenWiki Update** | `openwiki-update.yml` | Scheduled daily (08:00 UTC) + dispatch — regenerates wiki docs, creates auto-PR |

### Agent Orchestrator
The orchestrator (`.github/workflows/agent-orchestrator.yml`) is an automated CI bot that:
- Has `mode=fix` and `mode=execute` modes
- Rebases PRs before executing
- Scopes work to changed files
- Runs pre-flight gate checks (checks PR for failures before acting)
- Skips empty commits
- Manages deployments

## Production Deployment

### Docker Setup
```bash
# Build and run
docker compose -f docker-compose.app.yml up -d

# Requires external network: docker network create pfnapp-net
```

Two containers:
- **`pfnapp-web`** — Next.js web server (0.5 CPU / 512MB RAM)
- **`pfnapp-workers`** — BullMQ worker process

### Infrastructure Dependencies
- **PostgreSQL 16** with pgvector
- **Redis 7** (persistent, append-only)
- **Optional**: OpenSearch (log aggregation), S3-compatible storage (attachments)

### Database Migrations
```bash
# Production
bun run db:migrate:deploy
```

## Security Notes

- **Email domain validation** — `EMAIL_FROM` is validated to not contain `yourapp.com` placeholder; worker throws error if detected
- **API key hashing** — PBKDF2-SHA256 with configurable salt (`API_KEY_HASH_SALT`; defaults to "dev-salt-change-me" in dev)
- **Encryption** — `ENCRYPTION_KEY` used for sensitive data; `SUPPORT_TICKET_CONTENT_ENCRYPTION_KEY` for ticket content
- **VPN pairing** — HS256 JWT with `VPN_PAIRING_SECRET` (falls back to `JWT_SECRET`)
- **Support ticket attachments** — Stored in S3 with presigned URLs and file extension restrictions
- **Webhook HMAC** — WhatsApp webhooks verified with HMAC signature
