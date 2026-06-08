# Playwright E2E Tests

## Projects

| Project | Tests | Auth required |
|---------|-------|---------------|
| `chromium` | Landing page, public pages | No |
| `authenticated` | Console features (WhatsApp, invoices, etc.) | Yes — needs `.auth/user.json` |
| `auth-setup` | Interactive login helper (run once) | Needs you to sign in |

## Setup: Authenticated Tests

Console features are behind WorkOS OAuth login (Google/GitHub). To test them:

### 1. Run the auth setup once

```bash
bun run test:e2e:auth
```

This opens Chromium headed and navigates to `/en/login`. **You sign in** via your WorkOS-connected account (Google/GitHub). After successful login, Playwright detects the redirect to the console and saves the browser session state to `.auth/user.json`.

### 2. Run authenticated tests

```bash
bun run test:e2e:authenticated   # only authenticated tests
bun run test:e2e:all             # public + authenticated tests
```

The auth state persists until your WorkOS session expires. Re-run `bun run test:e2e:auth` when it does.

> **Note:** `.auth/` is gitignored. Each developer generates their own auth state.

## Useful Commands

| Command | What it does |
|---------|-------------|
| `bun run test:e2e` | Run all tests (skips authenticated if no auth state) |
| `bun run test:e2e:ui` | Open Playwright UI mode (interactive runner) |
| `bun run test:e2e:auth` | Run auth setup (interactive login) |
| `bun run test:e2e:authenticated` | Run only authenticated tests |
| `bun run test:e2e:public` | Run only public-page tests |
| `bun run test:e2e:all` | Run public + authenticated tests |

## Adding a New Console Spec

1. Name your file `console.<feature>.spec.ts` (e.g. `console.invoices.spec.ts`)
2. It's automatically picked up by the `authenticated` project
3. `storageState` is pre-applied — no need to handle auth in individual tests

## CI Considerations

Authenticated tests are **skipped in CI** unless `.auth/user.json` is available. For CI pipelines, you can either:

1. **Skip authenticated tests** (default — they're excluded from the chromium project)
2. **Inject a pre-saved auth file** as a CI secret (GitHub Actions `playwright-auth` secret)
3. **Use the static API key approach** for API-level verification instead
