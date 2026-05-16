# Next.js template

This is a Next.js template with shadcn/ui.

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
npm run prisma:migrate:dev -- --name add-platform-user-role
```

3. Generate Prisma client:

```bash
export DATABASE_URL=$(grep '^DATABASE_URL=' .env.local | cut -d= -f2- | sed 's/^"//; s/"$//')
npm run prisma:generate
```

### Grant first super admin

Use the included helper script:

```bash
export DATABASE_URL=$(grep '^DATABASE_URL=' .env.local | cut -d= -f2- | sed 's/^"//; s/"$//')
npm run grant:super-admin -- --workos-user-id=<workos_user_id> --email=<email_optional>
```

Example:

```bash
npm run grant:super-admin -- --workos-user-id=user_01J... --email=admin@company.com
```

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
