# Next.js template

[![codecov](https://codecov.io/gh/JuniYadi/projects-green/graph/badge.svg?token=xupk7WZCb4)](https://codecov.io/gh/JuniYadi/projects-green)

This is a Next.js template with shadcn/ui.

## Local Development Startup

1. Copy `.env.example` to `.env.local` and update non-local credentials.
2. Start local infrastructure (Postgres + Redis):

```bash
docker compose up -d postgres redis
```

3. Start the app:

```bash
bun run dev
```

4. Start the GitHub queue worker in a separate terminal when testing webhook
   flows:

```bash
bun run worker:github
```

Queue notes:

- `REDIS_URL`, `QUEUE_PREFIX`, and `GITHUB_EVENTS_QUEUE_NAME` are configurable
  for non-local deployments.
- Worker logs intentionally avoid secret values (for example Redis password).

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button";
```

## Multi-tenant Role Management (WorkOS)

This app uses a two-layer role model:

- Global platform role: `super_admin` (stored in DB table `PlatformUserRole`)
- Tenant membership role (WorkOS organization role): `owner`, `admin`, `member` (`user` is treated as `member` alias)

### Route access

- `/portal` is for tenant `owner/admin` and `super_admin`
- `/console` is for tenant `member`
- Wrong-role access is redirected to the allowed home route

### One-time setup

1. Ensure your database is running and `DATABASE_URL` in `.env.local` points to an existing database.
2. Run migration:

```bash
export DATABASE_URL=$(grep '^DATABASE_URL=' .env.local | cut -d= -f2- | sed 's/^"//; s/"$//')
bun run prisma:migrate:dev -- --name add-platform-user-role
```

3. Generate Prisma client:

```bash
export DATABASE_URL=$(grep '^DATABASE_URL=' .env.local | cut -d= -f2- | sed 's/^"//; s/"$//')
bun run prisma:generate
```

### Grant first super admin

Use the included helper script:

```bash
export DATABASE_URL=$(grep '^DATABASE_URL=' .env.local | cut -d= -f2- | sed 's/^"//; s/"$//')
bun run grant:super-admin -- --workos-user-id=<workos_user_id> --email=<email_optional>
```

Example:

```bash
bun run grant:super-admin -- --workos-user-id=user_01J... --email=admin@company.com
```

### Seed WorkOS roles for tenant routing

This app can work with both legacy and scoped role slugs.

Legacy slugs:

- `owner`
- `admin`
- `member`

Scoped slugs (recommended for explicit target/role mapping):

- `admin_owner` (maps to `admin/owner` superadmin claim)
- `user_owner`
- `user_admin`
- `user_member`

If these roles are missing, role-based routing and membership updates may fail
or behave unexpectedly (for example, org bootstrap creation can fail on role
assignment).

Run a dry run first:

```bash
bun run seed:workos-roles -- --dry-run
```

Apply changes:

```bash
bun run seed:workos-roles
```

Notes:

- The script is idempotent. It only creates missing roles.
- It requires `WORKOS_API_KEY` in your environment.

### Tenant governance APIs

All routes are under `/api`:

- `GET /tenants/:orgId/authorization`
- `GET /tenants/:orgId/members`
- `GET /tenants/:orgId/invitations`
- `POST /tenants/:orgId/invitations`
- `POST /tenants/:orgId/members/:memberId/promote`
- `POST /tenants/:orgId/members/:memberId/demote`
- `POST /tenants/:orgId/ownership/transfer`

### Promotion and invitation policy

- Owner/admin can invite as `member`
- Only owner can invite as `admin` or `owner`
- Admin can promote/demote `member <-> admin`
- Only owner can assign/remove `owner` and transfer ownership
- Last-owner guardrail is enforced on demotion/ownership changes

## Integration Guides

- [GitHub App Integration Specification](docs/github-app-integration.md)
