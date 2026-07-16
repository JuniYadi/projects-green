# Deploy (App Hosting) Module

**PGREEN-070** — The deploy module provides GitHub-integrated application hosting: framework detection, deployment pipelines, Helm chart generation, monitoring, and billing for hosted apps.

## Architecture

```
modules/deploy/
├── api/              → Deploy API routes
│   ├── routes/       → Submit, rollback, env-var, monitor routes
│   └── deploy.route.ts → Main deploy router
├── billing/          → Deployment billing integration
├── opensearch/       → OpenSearch log aggregation
├── ui/               → Deploy wizard UI
│   ├── deploy-wizard.tsx
│   ├── step-build.tsx
│   ├── step-environment.tsx
│   ├── resource-plan-selector.tsx
│   └── operate/      → 13 runtime tab components
├── *.service.ts      → Core services
├── *.types.ts        → TypeScript types
├── *.schema.ts       → Zod validation
├── *.constants.ts    → Deployment constants/templates
├── *.helm.ts         → Helm chart generation (~19 KB)
└── deploy.mock.ts    → Test fixtures
```

## Workflow

```
User connects GitHub repo → Framework Detection → Stack Creation → Build → Deploy → Monitor
```

### 1. GitHub Repository Connection
- User installs the GitHub App (`modules/github/`)
- Repositories are connected via `GithubRepositoryConnection` model
- Branch selection from connected repos

### 2. Framework Detection (`modules/framework-detection/`)

The framework detection system analyzes repository contents to determine:

- **Primary framework** — e.g., WordPress, n8n, Strapi, Next.js, Ghost, Directus
- **Ecosystem** — node, php, python, ruby, java, go, rust
- **Required dependencies** — runtimes and toolchains needed
- **Build commands** — auto-detected from package.json, Dockerfile, etc.
- **Confidence scoring** — with evidence trail (`DetectionEvidence[]`)

Supported templates: `wordpress`, `n8n`, `openclaw`, `ghost`, `strapi`, `directus`, `payload`, `pocketbase`, `umami`, `plausible`

Key types:
```typescript
// modules/deploy/deploy.types.ts
type DeploySourceType = "github" | "template"
type DeployTemplateId = "wordpress" | "n8n" | "openclaw" | "ghost" | "strapi" | "directus" | "payload" | "pocketbase" | "umami" | "plausible"
type ResourcePlanId = "starter" | "pro" | "payg"
type DeployStatus = "idle" | "queued" | "building" | "deploying" | "running" | "failed"
```

Key source: `modules/framework-detection/framework-detection.service.ts`, `framework-detection.types.ts`, `modules/deploy/deploy-detection.service.ts`

### 3. Stack Creation (`deploy-pipeline.service.ts`)
- Durable `ApplicationStack` record created in database
- Jenkins pipeline sync (non-blocking)
- Environment variable management

### 4. Build + Deploy

The pipeline:
1. **Builder service** (`deploy-builder.service.ts`) — prepares build context
2. **Helm chart generation** (`deploy.helm.ts`) — generates Kubernetes Helm charts from stack config (19 KB of chart generation logic)
3. **Deploy submission** — triggers the actual deployment via Jenkins
4. **Monitoring** (`deploy-monitor.service.ts`) — watches deployment progress

### 5. Monitoring & Logs

- **Monitor service** — tracks deployment status, updates `StackStatus`
- **OpenSearch integration** — logs aggregated in OpenSearch for querying
- **Deploy monitor worker** (`scripts/deploy-monitor-worker.ts`) — polls deployment status every 60s

## Billing

- **Resource plan selector** — `starter`, `pro`, `payg` plans
- **Pricing** (`deploy-pricing.ts`) — cost calculation based on CPU, memory, and plan
- **Billing mode** — `PAYG` or `PACKAGE`
- **Hourly cost** — computed from resource plan and usage
- Key source: `modules/deploy/deploy-pricing.ts`

## UI: Deploy Wizard

The deploy wizard is a multi-step form:

1. **Source** — select GitHub repo or template
2. **Build** — configure framework, build command, root directory
3. **Environment** — set environment variables, secrets
4. **Review & Deploy** — summary and submit

The operate UI (`modules/deploy/ui/operate/`) provides runtime management with 13+ tab components for monitoring running deployments.

## Jenkins Integration

- `modules/deploy/deploy-pipeline.service.ts` — syncs Jenkins pipeline DSL for stacks
- `modules/jenkins/` — Jenkins client and sync service
- Non-blocking — Jenkins sync failure doesn't fail stack creation

## Key Services

| Service | File | Purpose |
|---------|------|---------|
| Detection | `deploy-detection.service.ts` | Framework/language detection with confidence scoring |
| Pipeline | `deploy-pipeline.service.ts` | Stack upsert, Jenkins sync |
| Builder | `deploy-builder.service.ts` | Build context preparation |
| Helm | `deploy.helm.ts` | Kubernetes Helm chart generation |
| Monitor | `deploy-monitor.service.ts` | Deployment status monitoring |
| Config | `deploy-config.ts` | Stack configuration management |
| Rollback | `deploy-rollback.service.ts` | Rollback to previous deployment |
| Event | `deploy-event.service.ts` | Deployment event handling |
| Logic | `deploy.logic.ts` | Pure deployment logic |
| Store | `deploy.store.tsx` | React context store for deploy wizard state |

## OpenSearch Logging

- Log entries are ingested to OpenSearch for search and analysis
- Configurable per-region OpenSearch endpoints (see `.env.example`)
- Ingest worker: `scripts/opensearch-ingest-worker.ts`

## Routes

| Method | Path | Handler |
|--------|------|---------|
| Various | `/api/deploy/*` | Main deploy router |
| Various | `/api/deploy/submit` | Deploy submission |
| Various | `/api/deploy/rollback` | Rollback |
| Various | `/api/deploy/environment` | Environment variable management |
| Various | `/api/deploy/monitor` | Deployment monitoring |
