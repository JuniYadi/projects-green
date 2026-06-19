# Playwright E2E Tests

## Projects

| Project | Tests | Auth required |
|---------|-------|---------------|
| `public` | Landing page, public pages | No |
| `console` | Console/billing features (user role) | Yes — needs `.auth/user.json` |
| `admin` | Portal billing features (admin role) | Yes — needs `.auth/admin.json` |
| `auth-setup` | Interactive user login helper (run once) | Needs you to sign in |
| `admin-auth-setup` | Interactive admin login helper (run once) | Needs you to sign in as admin |

Tests are organized by directory path — `console/` dir → user auth, `admin/` dir → admin auth, `landing/` dir → no auth.

## Setup: Authenticated Tests

Both console and admin features are behind WorkOS OAuth login. Each role has its own auth state file.

### 1. Run the auth setup (one per role)

```bash
bun run test:e2e:auth          # user/member role → .auth/user.json
bun run test:e2e:admin-auth    # admin/owner/super_admin → .auth/admin.json
```

Each opens Chromium headed and navigates to `/en/login`. **You sign in** via your WorkOS-connected account. After successful login, Playwright saves the browser session state.

### 2. Run tests

```bash
bun run test:e2e:console   # only console tests (user role)
bun run test:e2e:admin     # only portal tests (admin role)
bun run test:e2e:public    # only public page tests
bun run test:e2e:all       # public + console + admin
```

> **Note:** `.auth/` is gitignored. Each developer generates their own auth state.
> Tests for a role are automatically skipped if its auth file doesn't exist.

## Use Case Coverage

Use cases are defined in `goals/use-case.md`. Each test is annotated with its UC number.

| Dir | File | Use Cases |
|-----|------|-----------|
| `billing/admin/` | `overview.spec.ts` | UC-1, UC-2, UC-3, UC-22, UC-23 |
| `billing/admin/` | `org-billing.spec.ts` | UC-4 to UC-16 |
| `billing/admin/` | `voucher.spec.ts` | UC-17 to UC-21 |
| `billing/admin/` | `invoices.spec.ts` | UC-9 |
| `billing/console/` | `dashboard.spec.ts` | UC-1, UC-2 |
| `billing/console/` | `topup.spec.ts` | UC-3 |
| `billing/console/` | `invoices.spec.ts` | UC-4 to UC-8 |
| `billing/console/` | `usage.spec.ts` | UC-9 to UC-11 |
| `billing/console/` | `transactions.spec.ts` | UC-12 |
| `billing/console/` | `subscription.spec.ts` | UC-13 |
| `billing/console/` | `vouchers.spec.ts` | UC-14 to UC-15 |
| `billing/console/` | `contacts.spec.ts` | UC-16 |
| `billing/console/` | `alerts.spec.ts` | UC-17 |
| `billing/console/` | `settings.spec.ts` | UC-18 |
| `billing/console/` | `payment-confirm.spec.ts` | UC-19 |

## Useful Commands

| Command | What it does |
|---------|-------------|
| `bun run test:e2e` | Run all tests (skips auth-required if no auth state) |
| `bun run test:e2e:ui` | Open Playwright UI mode (interactive runner) |
| `bun run test:e2e:auth` | Run user auth setup (interactive login) |
| `bun run test:e2e:admin-auth` | Run admin auth setup (interactive login) |
| `bun run test:e2e:console` | Run only console tests |
| `bun run test:e2e:admin` | Run only admin tests |
| `bun run test:e2e:public` | Run only public page tests |
| `bun run test:e2e:all` | Run public + console + admin tests |

## Adding a New Spec

1. Place it in the right `feature/role/` dir (`console/`, `admin/`, or `landing/`)
2. Auth state is pre-applied by the project — no need to handle auth in individual tests
3. Annotate tests with UC numbers from `goals/use-case.md`
