# App Logs and Step Tracking UX Specification

## 1. Objective

Provide clear, user-facing logs that explain every execution step in app
operations, especially GitHub-driven flows (push -> build -> sync -> deploy).
The system must help users answer:

1. what is running now
2. what already succeeded
3. where a failure happened
4. what needs manual action

## 2. Recommendation: Unified Pipeline, Dual Views

Use one unified log/event pipeline, then expose two UI surfaces:

1. Global logs page for operators: `/console/logs`
2. App-scoped logs page for developers: `/console/app/logs`

Why this is better than separate pipelines:

- single ingestion and schema avoids duplicated logic
- easy cross-app debugging when shared infra fails
- app users still get focused logs via pre-filtered app view
- retention, search, and alerting are managed once

Conclusion:

- Do not split logging infrastructure by page.
- Split only the UX entry points and default filters.

## 3. Primary Use Cases

1. User pushes commit to GitHub and wants live status of processing steps.
2. User wants to verify build trigger and deployment sync happened.
3. User needs failure reason and retry action for specific step.
4. User wants complete timeline for one app/environment.
5. Operator needs global incident visibility across all apps.

## 4. Product Surfaces

### 4.1 App Logs (`/console/app/logs`)

Default filters:

- appId = current app
- environment = selected environment
- time range = last 24h

Layout:

- Header status strip:
  - latest workflow state (`Running`, `Succeeded`, `Failed`)
  - active step (`Build Image`, `Sync Deployment`, etc.)
  - current duration
- Step timeline panel (grouped by workflow run)
- Event table panel (raw events)
- Side drawer for event details (payload, error, retry history)

### 4.2 Global Logs (`/console/logs`)

Default filters:

- all apps
- all environments
- last 1h
- severity >= `info`

Layout:

- Throughput and error charts
- App/environment filter bar
- Unified event stream table

## 5. Canonical Step Model

Every tracked flow is represented as a workflow run with ordered steps.

### 5.1 Workflow Types

- `github_push_pipeline`
- `manual_release`
- `env_update_rollout`
- `domain_ssl_issuance`
- `mount_update_rollout`

### 5.2 Standard Step Status

- `queued`
- `running`
- `succeeded`
- `failed`
- `skipped`
- `waiting_input`
- `canceled`

### 5.3 Standard Step Names for GitHub Flow

1. `webhook_received`
2. `signature_verified`
3. `event_deduplicated`
4. `build_queued`
5. `build_started`
6. `build_succeeded`
7. `artifact_published`
8. `deploy_sync_queued`
9. `deploy_sync_started`
10. `deploy_rollout_started`
11. `deploy_healthcheck_passed`
12. `pipeline_succeeded`

Failure can happen on any step and should record a clear error code and message.

## 6. Data Contracts (Dummy but Realistic)

### 6.1 Workflow Run

```json
{
  "runId": "run_01JVDBG4P3WB9KJ7A6",
  "workflowType": "github_push_pipeline",
  "appId": "app_7Wf2XzQ1",
  "appName": "laravel-shop",
  "environment": "staging",
  "status": "running",
  "trigger": {
    "type": "github_push",
    "deliveryId": "b9d3e550-9e8e-11ef-8b6d-acde48001122",
    "repository": "acme/laravel-shop",
    "branch": "main",
    "commit": "9f31e2b1c2a1a8a2b4c7d9019b41c7e5513f2b7a"
  },
  "startedAt": "2026-05-20T03:10:20Z",
  "endedAt": null,
  "durationMs": 81234
}
```

### 6.2 Step Event

```json
{
  "eventId": "evt_01JVDBM2Z7J0W4F4R0",
  "runId": "run_01JVDBG4P3WB9KJ7A6",
  "step": "build_started",
  "status": "running",
  "severity": "info",
  "message": "Container build started on builder pool bld-us-01.",
  "metadata": {
    "builderJobId": "job_482920",
    "imageTarget": "ghcr.io/acme/laravel-shop:sha-9f31e2b"
  },
  "attempt": 1,
  "occurredAt": "2026-05-20T03:11:05Z"
}
```

### 6.3 Failure Event

```json
{
  "eventId": "evt_01JVDBQ9J4V7Y2T3AA",
  "runId": "run_01JVDBG4P3WB9KJ7A6",
  "step": "deploy_healthcheck_passed",
  "status": "failed",
  "severity": "error",
  "errorCode": "HEALTHCHECK_TIMEOUT",
  "message": "Deployment health check exceeded 300 seconds.",
  "metadata": {
    "release": "release-2026.05.20-18",
    "readyReplicas": 1,
    "desiredReplicas": 3
  },
  "attempt": 1,
  "occurredAt": "2026-05-20T03:18:45Z"
}
```

## 7. UI Behavior Details

### 7.1 Workflow Timeline Card

For each run show:

- trigger summary (`push main @ 9f31e2b`)
- current step
- elapsed time
- overall result badge
- quick actions:
  - `View details`
  - `Retry failed step` (if allowed)
  - `Re-run pipeline`

### 7.2 Event Table Columns

- Time
- App
- Env
- Workflow
- Step
- Status
- Severity
- Message
- Actor/Source (`github`, `system`, `user:jane`)
- Correlation ID

### 7.3 Event Detail Drawer

Sections:

- Summary (step, status, timestamp)
- Payload snippet (sanitized)
- Infra IDs (`deliveryId`, `jobId`, `releaseId`, `pod`)
- Retry history
- Linked actions:
  - open deployment page
  - open commit in GitHub
  - copy trace id

## 8. Filtering and Query Model

Supported filters:

- appId
- environment
- workflowType
- status
- severity
- step name
- time range
- free text search (`message`, `errorCode`, `commit`, `deliveryId`)

Saved views examples:

- `My app failed workflows (24h)`
- `All production failures (1h)`
- `GitHub delivery issues (7d)`

## 9. API Design (UI-Facing)

### 9.1 Read Endpoints

- `GET /api/logs/runs`
- `GET /api/logs/runs/:runId`
- `GET /api/logs/events`
- `GET /api/logs/events/:eventId`

Query examples:

- `/api/logs/runs?appId=app_7Wf2XzQ1&environment=staging&status=failed`
- `/api/logs/events?workflowType=github_push_pipeline&deliveryId=b9d3e550-9e8e-11ef-8b6d-acde48001122`

### 9.2 Action Endpoints

- `POST /api/logs/runs/:runId/retry`
- `POST /api/logs/runs/:runId/cancel`
- `POST /api/logs/runs/:runId/rerun`

### 9.3 Stream Endpoint

- `GET /api/logs/stream` (SSE)

SSE event types:

- `run.updated`
- `step.updated`
- `event.created`

## 10. GitHub Event Breakdown (Detailed)

For push-triggered pipelines, UI should map backend events to these visible
user steps:

1. GitHub webhook received
2. Signature verified
3. Duplicate check complete
4. Build job queued
5. Build job started
6. Build finished
7. Artifact pushed
8. Deploy sync queued
9. Deploy sync started
10. Rollout started
11. Health checks completed
12. Pipeline completed

If step fails, show:

- failed step name
- direct error reason
- suggested next action

Suggested next-action messages:

- `Verify Dockerfile build stage and retry.`
- `Check cluster capacity for pending pods.`
- `Confirm DNS record before SSL re-issue.`

## 11. Validation and Guardrails

- redact secret values from payloads and messages
- keep immutable event history (append-only)
- enforce idempotency for duplicate webhook deliveries
- include correlation IDs across webhook, queue, build, and deploy systems
- permission checks:
  - viewers can read logs only
  - retry/cancel/rerun require developer+ role

## 12. Retention and Performance

- hot storage: 14 days for fast search
- warm archive: 90 days compressed
- pagination: cursor-based
- table virtualization for large streams
- index keys: `appId`, `environment`, `status`, `occurredAt`, `workflowType`

## 13. QA Scenarios

1. Push to `main` and verify all 12 GitHub pipeline steps are visible in order.
2. Send duplicate delivery id and verify dedupe step marks `skipped` correctly.
3. Force build failure and verify failure step, error code, and retry action.
4. Filter by `appId + staging + failed` and verify only matching runs appear.
5. Open global logs and verify cross-app events still use same schema.

## 14. Out of Scope

- full observability metrics/traces replacement
- third-party SIEM export configuration UI
- long-term compliance retention policy editor
