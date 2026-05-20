# App Infrastructure Management UX Specification

## 1. Objective

Define the post-deploy infrastructure management experience for apps deployed from
GitHub (primary use case: Laravel). This document focuses on day-1/day-2 tasks
inside UI/UX, while `docs/deploy.md` remains focused on day-0 deployment.

## 2. Primary Use Case

User wants to deploy and manage a Laravel app from a GitHub repository. They
must be able to:

1. manage environment variables
2. update app runtime (image/tag/commit)
3. delete app safely
4. mount file-based config/cert/key into pods
5. configure custom domain and enable SSL

## 3. Product Surfaces

### 3.1 Route and Layout

- Route: `/console/app/manage`
- Entry point from deploy success screen and app details page
- Header:
  - app name
  - environment switcher (`dev`, `staging`, `prod`)
  - health badge (`Healthy`, `Degraded`, `Down`)
- Main navigation tabs:
  - `Overview`
  - `Environment`
  - `Update`
  - `Storage & Mounts`
  - `Domain & SSL`
  - `Danger Zone`

### 3.2 Role Access

- `Owner`: full access including delete app and domain change
- `Admin`: all except delete app (unless explicitly granted)
- `Developer`: view + update + env edit (no delete, no TLS secret replace)
- `Viewer`: read-only

## 4. Information Architecture by Tab

### 4.1 Overview

Purpose: fast status of runtime and recent operations.

Sections:

- Deployment summary:
  - current release (`release-2026.05.20-18`)
  - source (`github.com/acme/laravel-shop`)
  - image (`ghcr.io/acme/laravel-shop:sha-9f31e2b`)
  - pods (`3/3 ready`)
- Infra summary cards:
  - env vars count (`42`, `5 masked`)
  - mounted files (`3 active mounts`)
  - domains (`2`, `1 primary`)
  - cert status (`Let's Encrypt - valid, expires in 71 days`)
- Timeline:
  - env updates
  - rollouts
  - domain verification events
  - mount changes

### 4.2 Environment

Purpose: CRUD env variables with safety and auditability.

UI breakdown:

- Toolbar:
  - search input (`Filter by key`)
  - `Add variable` button
  - `Bulk import .env` button
- Table columns:
  - `Key`
  - `Value` (masked/unmasked toggle)
  - `Type` (`plain`, `secret`)
  - `Scope` (`runtime`, `build`)
  - `Last updated`
  - `Actions` (`Edit`, `Delete`)
- Side panel form (`Add/Edit variable`):
  - Key (required, uppercase + `_`)
  - Value (required unless delete)
  - Secret toggle
  - Scope selector
  - Apply mode:
    - `Apply immediately (rolling restart)`
    - `Save for next deploy`

Laravel-focused presets shown as quick chips:

- `APP_ENV`
- `APP_KEY`
- `APP_DEBUG`
- `APP_URL`
- `DB_CONNECTION`
- `DB_HOST`
- `DB_PORT`
- `DB_DATABASE`
- `DB_USERNAME`
- `DB_PASSWORD`
- `CACHE_DRIVER`
- `QUEUE_CONNECTION`

### 4.3 Update

Purpose: update app version safely and track rollout.

UI breakdown:

- Current release panel
- Update source selector:
  - `Git commit`
  - `Container image tag`
- Inputs:
  - branch (default: `main`)
  - commit SHA (optional)
  - image tag (if image mode)
- Strategy selector:
  - `Rolling` (default)
  - `Recreate` (with warning)
- Optional pre-deploy command:
  - `php artisan migrate --force`
- Action buttons:
  - `Preview changes`
  - `Start update`
  - `Rollback`

Rollout view:

- phase list: `Queued -> Pulling image -> Starting pods -> Health checks`
- live pod table:
  - pod name
  - revision
  - status
  - restart count

### 4.4 Storage & Mounts

Purpose: manage file mounts into containers for advanced app needs.

Supported mount sources:

- Inline text file
- Uploaded file
- Existing secret/config object

UI breakdown:

- Mount list table:
  - `Name`
  - `Mount path`
  - `Type` (`file`, `dir`)
  - `Source` (`secret`, `config`, `upload`)
  - `Read-only`
  - `Last rollout`
- `Create mount` modal:
  - Mount name
  - Container path (required, absolute)
  - File name (if single-file mount)
  - Source type
  - Content/upload field
  - File mode (`0400`, `0440`, `0644`)
  - Read-only toggle (default on)
  - Apply mode (`rolling restart` or `next deploy`)

Laravel examples displayed in helper hints:

- `/var/www/html/storage/app/service-account.json`
- `/var/www/html/bootstrap/cache/packages.php` (read-only warning)
- `/etc/ssl/private/custom-ca.pem`

Guardrails:

- block forbidden paths:
  - `/bin`
  - `/sbin`
  - `/usr/bin`
  - `/proc`
  - `/sys`
- conflict detection if two mounts target same path
- warn for writeable mount inside application code path

### 4.5 Domain & SSL

Purpose: bind custom domains to app ingress and manage TLS.

UI breakdown:

- Domains table:
  - `Domain`
  - `Primary`
  - `Protocol`
  - `TLS status`
  - `DNS status`
  - `Actions`
- `Add domain` wizard:
  1. Enter domain (`shop.acme.com`)
  2. Select certificate mode:
     - `Managed (Let's Encrypt)`
     - `Bring your own certificate`
  3. Show DNS records to configure
  4. Verify domain ownership
  5. Enable HTTPS redirect toggle

If BYOC selected:

- cert PEM textarea
- private key PEM textarea
- optional chain PEM
- `Test certificate` action before save

TLS status badges:

- `Pending DNS`
- `Issuing`
- `Active`
- `Expiring soon`
- `Failed`

### 4.6 Danger Zone

Purpose: explicit destructive operations.

Actions:

- Delete environment deployment (`staging` only)
- Delete entire app (`dev`, `staging`, `prod`, domain bindings, runtime config)

Delete app confirmation modal:

- text input: `DELETE <app-name>`
- checklist:
  - remove traffic routing
  - delete secrets/config
  - retain logs for 7 days
- final button: `Delete app permanently`

## 5. Realistic Dummy Data Contracts

### 5.1 App Manage Payload

```json
{
  "appId": "app_7Wf2XzQ1",
  "name": "laravel-shop",
  "framework": "laravel",
  "repository": {
    "provider": "github",
    "fullName": "acme/laravel-shop",
    "branch": "main",
    "lastCommit": "9f31e2b1c2a1a8a2b4c7d9019b41c7e5513f2b7a"
  },
  "environment": "staging",
  "deployment": {
    "release": "release-2026.05.20-18",
    "image": "ghcr.io/acme/laravel-shop:sha-9f31e2b",
    "replicas": 3,
    "readyReplicas": 3,
    "health": "healthy"
  },
  "runtime": {
    "envCount": 42,
    "secretCount": 5,
    "mountCount": 3,
    "domains": 2
  }
}
```

### 5.2 Environment Variable Record

```json
{
  "id": "env_01JVD7MNKQRE3N4YZ5",
  "key": "DB_PASSWORD",
  "value": "********",
  "isSecret": true,
  "scope": "runtime",
  "updatedBy": "user_8k2f",
  "updatedAt": "2026-05-20T02:00:15Z"
}
```

### 5.3 File Mount Record

```json
{
  "id": "mnt_01JVD7V8K6D5S3Q71F",
  "name": "google-service-account",
  "mountPath": "/var/www/html/storage/app/service-account.json",
  "sourceType": "secret",
  "fileMode": "0400",
  "readOnly": true,
  "lastRollout": "release-2026.05.20-18"
}
```

### 5.4 Domain Record

```json
{
  "id": "dom_01JVD82YPP2M6BT5Y2",
  "domain": "shop.acme.com",
  "isPrimary": true,
  "tlsMode": "managed",
  "tlsStatus": "active",
  "dnsStatus": "verified",
  "expiresAt": "2026-08-01T12:00:00Z",
  "httpsRedirect": true
}
```

## 6. API Design (UI-Facing, Dummy but Realistic)

### 6.1 Environment

- `GET /api/apps/:appId/environments/:env/variables`
- `POST /api/apps/:appId/environments/:env/variables`
- `PATCH /api/apps/:appId/environments/:env/variables/:varId`
- `DELETE /api/apps/:appId/environments/:env/variables/:varId`
- `POST /api/apps/:appId/environments/:env/variables/import`

### 6.2 Update

- `POST /api/apps/:appId/environments/:env/releases/preview`
- `POST /api/apps/:appId/environments/:env/releases`
- `POST /api/apps/:appId/environments/:env/releases/:releaseId/rollback`

### 6.3 Mounts

- `GET /api/apps/:appId/environments/:env/mounts`
- `POST /api/apps/:appId/environments/:env/mounts`
- `PATCH /api/apps/:appId/environments/:env/mounts/:mountId`
- `DELETE /api/apps/:appId/environments/:env/mounts/:mountId`

### 6.4 Domain and SSL

- `GET /api/apps/:appId/environments/:env/domains`
- `POST /api/apps/:appId/environments/:env/domains`
- `POST /api/apps/:appId/environments/:env/domains/:domainId/verify`
- `POST /api/apps/:appId/environments/:env/domains/:domainId/enable-ssl`
- `POST /api/apps/:appId/environments/:env/domains/:domainId/rotate-cert`
- `DELETE /api/apps/:appId/environments/:env/domains/:domainId`

### 6.5 Delete Operations

- `DELETE /api/apps/:appId/environments/:env`
- `DELETE /api/apps/:appId`

## 7. Validation and Error Behavior

### 7.1 Environment Validation

- key regex: `^[A-Z][A-Z0-9_]*$`
- duplicate key in same env: blocked
- max value size: 32 KB
- secret values never returned in plain text after save

### 7.2 Mount Validation

- path must be absolute and not forbidden
- max file size: 1 MB per mount item
- file mode must be one of `0400`, `0440`, `0644`
- conflict path check before submit

### 7.3 Domain and TLS Validation

- valid FQDN required
- one primary domain per environment
- managed cert requires DNS verified status
- BYOC cert + key must pass parse and match test

### 7.4 Delete Validation

- delete app requires explicit typed confirmation
- block delete if operation lock exists (`deployment in progress`)

## 8. UX Feedback and Status Copy

Success toasts:

- `Environment variable saved. Rolling restart started.`
- `Release update started for staging.`
- `Mount created and attached to next rollout.`
- `Domain verified. SSL issuance in progress.`

Error toasts:

- `Failed to save variable: key already exists in staging.`
- `Mount path conflict: /var/www/html/storage/app/service-account.json`
- `SSL issuance failed: DNS record not propagated.`
- `Delete blocked: active rollout is still running.`

## 9. Activity Log Events

Events emitted to timeline for audit:

- `env.variable.created`
- `env.variable.updated`
- `env.variable.deleted`
- `release.started`
- `release.succeeded`
- `release.failed`
- `mount.created`
- `mount.updated`
- `mount.deleted`
- `domain.added`
- `domain.verified`
- `tls.issued`
- `tls.failed`
- `app.deleted`

## 10. QA Scenarios

1. Add `APP_KEY` as secret in `staging`; verify masked display and rollout event.
2. Update image tag; verify rollout phases and health gating.
3. Create file mount for service account JSON; verify mounted path and read-only.
4. Add `shop.acme.com` with managed SSL; verify DNS instructions and status
   transition `Pending DNS -> Issuing -> Active`.
5. Attempt delete while rollout runs; verify blocked state and clear guidance.

## 11. Out of Scope

- direct shell/exec into pod from this page
- cluster/node autoscaling policy editor
- WAF/CDN policy management
- cross-region traffic steering
