# GitHub App Integration Specification

## 1. Objective

Add a production-ready GitHub App integration so authenticated users can:

1. Authorize and connect GitHub to this app.
2. List repositories that are installed for this app.
3. Receive GitHub push webhooks.
4. Trigger builds when matching commits arrive (for example branch `main`).

This specification is implementation-ready for the existing stack:

- Next.js App Router (`app/api/...` route handlers)
- WorkOS-backed user auth (`withAuth`)
- Prisma + PostgreSQL
- Async webhook processing via queue-backed worker

## 2. User Journey

### 2.1 Connect GitHub App

1. User clicks `Connect GitHub` in deploy source step.
2. Frontend calls `GET /api/integrations/github/install/start`.
3. Backend validates user session (`withAuth`) and creates signed `state` with:
   - `workosUserId`
   - `organizationId` (nullable)
   - `returnTo` (UI path)
   - `nonce`
   - `expiresAt`
4. Backend redirects user to GitHub App installation URL.
5. User selects account/org and repositories in GitHub install UI.
6. GitHub redirects to callback URL with `installation_id` and `state`.
7. Backend verifies `state`, upserts installation record, and redirects user back.

### 2.2 List Repositories (Installed Repos Only)

1. Frontend calls `GET /api/integrations/github/repositories?ownerId=<id>&query=<q>`.
2. Backend resolves active installations for current user/org.
3. Backend uses installation access token per installation.
4. Backend returns only repositories accessible by those installations.

### 2.3 Push-to-Build

1. GitHub sends `push` webhook to `POST /api/integrations/github/webhook`.
2. Backend verifies signature and deduplicates by delivery id.
3. Backend persists event record and enqueues job.
4. Worker loads repository connection rules.
5. Worker triggers build only if:
   - repository connection is enabled
   - branch matches configured branch filters
6. Worker updates event status and build dispatch result.

## 3. Runtime Architecture

### 3.1 HTTP Layer

- Route handlers under `app/api/integrations/github/...`.
- Webhook endpoint must return quickly after verification and enqueue.
- Do not run heavy build logic in webhook request lifecycle.

### 3.2 Queue Layer

Use queue-backed async processing with at-least-once semantics.

Minimum requirements:

- enqueue by `eventId`
- retry with backoff
- dead-letter handling
- explicit idempotency key handling

Recommended initial approach:

- Use BullMQ + Redis with queue helpers under `lib/queue/github-events.ts`.
- Keep queue access encapsulated so job payload/flow can evolve without touching
  route handlers.

### 3.3 Worker Layer

Worker consumes enqueued GitHub events and:

1. acquires idempotency lock (`deliveryId + event`)
2. checks installation/repo mapping
3. evaluates branch match
4. dispatches internal build job
5. marks processing outcome

## 4. API Contracts

## 4.1 `GET /api/integrations/github/install/start`

Purpose: Start app installation flow.

Auth: required (`withAuth`).

Query params:

- `returnTo` optional (default `/console`)

Response:

- `302` redirect to GitHub App install URL

Behavior:

- Generate signed short-lived `state` (HMAC/JWT, TTL 10 minutes).
- Persist nonce hash in DB for one-time use.

## 4.2 `GET /api/integrations/github/install/callback`

Purpose: Complete install flow and bind installation to user/org context.

Auth: required.

Query params (from GitHub):

- `installation_id` required
- `setup_action` optional (`install` / `update`)
- `state` required

Response:

- `302` redirect back to `returnTo` with status query:
  - `github=connected` on success
  - `github=error` on failure

Behavior:

- Validate state signature, expiry, nonce single-use.
- Fetch installation details from GitHub API.
- Upsert `GithubInstallation`.
- Sync installation repositories snapshot.

## 4.3 `GET /api/integrations/github/repositories`

Purpose: List repositories from active installations only.

Auth: required.

Query params:

- `ownerId` optional
- `query` optional
- `cursor` optional
- `limit` optional (default 20, max 100)

Success response:

```json
{
  "ok": true,
  "items": [
    {
      "repositoryId": 123456,
      "fullName": "acme/service-api",
      "name": "service-api",
      "owner": "acme",
      "installationId": 7890,
      "defaultBranch": "main",
      "private": true,
      "pushedAt": "2026-05-16T03:10:45.000Z"
    }
  ],
  "nextCursor": null
}
```

## 4.4 `POST /api/integrations/github/webhook`

Purpose: Receive GitHub webhook events.

Auth: none (public endpoint, signature protected).

Headers required:

- `X-GitHub-Event`
- `X-GitHub-Delivery`
- `X-Hub-Signature-256`

Response:

- `202` accepted when signature valid and enqueue succeeds
- `401/403` for invalid signature
- `400` malformed payload

Behavior:

- Use raw request body to verify HMAC SHA-256 with webhook secret.
- Deduplicate by `deliveryId`.
- Persist event row and enqueue by event row id.

## 5. Data Model (Prisma)

Add these models to `prisma/schema.prisma`.

```prisma
model GithubInstallation {
  id                  String   @id @default(cuid())
  githubInstallationId BigInt  @unique
  accountLogin        String
  accountType         String
  targetType          String
  targetId            BigInt?
  workosUserId        String
  organizationId      String?
  status              String   @default("active")
  permissionsJson     Json?
  eventsSubscribed    Json?
  installedAt         DateTime @default(now())
  updatedAt           DateTime @updatedAt

  repositories GithubRepositoryConnection[]

  @@index([workosUserId])
  @@index([organizationId])
  @@index([accountLogin])
}

model GithubRepositoryConnection {
  id                   String   @id @default(cuid())
  githubRepositoryId   BigInt
  installationId       String
  fullName             String
  ownerLogin           String
  repoName             String
  defaultBranch        String?
  isPrivate            Boolean
  enabled              Boolean  @default(true)
  branchFilters        String[] @default(["main"])
  rootDirectory        String   @default("/")
  buildConfigJson      Json?
  lastSyncedAt         DateTime?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  installation GithubInstallation @relation(fields: [installationId], references: [id], onDelete: Cascade)

  @@unique([githubRepositoryId, installationId])
  @@index([installationId])
  @@index([fullName])
}

model GithubWebhookEvent {
  id               String   @id @default(cuid())
  deliveryId       String   @unique
  eventName        String
  action           String?
  githubInstallationId BigInt?
  githubRepositoryId   BigInt?
  payloadJson      Json
  payloadSha256    String
  signatureValid   Boolean
  enqueueStatus    String   @default("queued")
  processStatus    String   @default("pending")
  processError     String?
  receivedAt       DateTime @default(now())
  processedAt      DateTime?

  @@index([eventName])
  @@index([githubInstallationId])
  @@index([githubRepositoryId])
  @@index([processStatus])
}
```

Notes:

- Keep `payloadJson` trimmed to necessary fields if payload-size pressure appears.
- `deliveryId` uniqueness provides first-line replay protection.

## 6. GitHub App Configuration

Create GitHub App with:

- Permissions:
  - Repository metadata: read-only
  - Repository contents: read-only (for analysis)
- Webhooks:
  - Subscribe to `push`
- Callback URL:
  - `https://<app-host>/api/integrations/github/install/callback`
- Webhook URL:
  - `https://<app-host>/api/integrations/github/webhook`

Recommended optional permissions if analysis expands later:

- Pull requests: read-only
- Checks: read-only

## 7. Environment Variables

Add to `.env.example`:

```env
GITHUB_APP_ID=
GITHUB_APP_SLUG=
GITHUB_APP_CLIENT_ID=
GITHUB_APP_CLIENT_SECRET=
GITHUB_APP_PRIVATE_KEY_BASE64=
GITHUB_WEBHOOK_SECRET=
GITHUB_APP_INSTALL_REDIRECT_URI=
GITHUB_APP_NAME=
REDIS_URL=
QUEUE_PREFIX=
GITHUB_EVENTS_QUEUE_NAME=
```

Rules:

- Store private key as base64-encoded PEM for safer multiline handling.
- Configure Redis via `REDIS_URL` for each environment (local, staging, prod).
- Use queue namespace controls (`QUEUE_PREFIX`, `GITHUB_EVENTS_QUEUE_NAME`) to
  isolate environments.
- Never log token material, signatures, or raw secrets.

## 8. Branch Trigger Rules

Per `GithubRepositoryConnection`:

- `enabled` controls whether webhook events can trigger builds.
- `branchFilters` controls allowed branches.
- Default value: `["main"]`.

Branch matching logic for `push`:

1. extract `ref` (for example `refs/heads/main`)
2. derive branch name (`main`)
3. trigger when branch is in `branchFilters`

Do not trigger when:

- `deleted = true`
- non-head refs (tags)
- connection disabled
- no repository connection found

## 9. Implementation Layout

Suggested file map:

- `app/api/integrations/github/install/start/route.ts`
- `app/api/integrations/github/install/callback/route.ts`
- `app/api/integrations/github/repositories/route.ts`
- `app/api/integrations/github/webhook/route.ts`
- `modules/github/github.service.ts`
- `modules/github/github.types.ts`
- `modules/github/github.webhook.ts`
- `lib/github/app-auth.ts`
- `lib/queue/github-events.ts`
- `scripts/github-worker.ts`

UI integration points:

- Replace disabled `Connect GitHub` button in deploy source step with install start link/call.
- Source step owner/repo selectors should consume `/api/integrations/github/repositories`.

## 10. Security Controls

Required:

- Verify webhook signature against raw body.
- Reject expired/invalid install callback state.
- One-time nonce use for state replay prevention.
- Validate installation ownership against authenticated context.
- Idempotent event processing by `deliveryId`.

Operational safeguards:

- structured audit logs for install connect/disconnect
- rate limiting on public webhook route
- dead-letter and alerting for repeated worker failures

## 11. Testing Matrix

## 11.1 Unit Tests

- state token generation and validation
- webhook signature verification
- branch filter matching logic
- idempotency guard logic

## 11.2 Integration Tests

- install callback upsert path
- repository list endpoint pagination/filtering
- webhook route acceptance/rejection paths
- worker-triggered build dispatch for matching branch

## 11.3 End-to-End Scenarios

1. User connects GitHub org with selected repos.
2. Repositories appear in deploy source selector.
3. Push to `main` triggers exactly one build for enabled repo.
4. Push to non-configured branch does not trigger build.
5. Duplicate delivery ID does not produce duplicate build.

## 12. Rollout Plan

1. Merge schema + API + worker behind feature flag `github_app_integration`.
2. Internal test on staging with one org installation.
3. Enable for selected tenant/org.
4. Monitor webhook success rate, queue latency, build trigger success.
5. Gradually enable for all tenants.

## 13. Non-Goals (Initial Version)

- GitHub OAuth token-based listing outside app installations
- Automated repo write operations
- Multi-provider SCM abstraction
