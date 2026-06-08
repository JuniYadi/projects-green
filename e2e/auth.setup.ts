/**
 * Playwright auth setup — interactive login via WorkOS OAuth.
 *
 * Run this once per session to save authenticated browser state
 * to `.auth/user.json`.  All tests in the "authenticated" project
 * load this state automatically.
 *
 * Usage:
 *   bun run test:e2e:auth         # interactive (opens headed browser)
 *   bun run test:e2e              # runs all tests (skips auth setup if .auth/user.json exists)
 *
 * The flow:
 *   1. Opens Chromium headed
 *   2. Navigates to /en/login
 *   3. YOU sign in via WorkOS (Google/GitHub/Apple)
 *   4. After redirect back to the app, Playwright detects the console URL
 *   5. Saves storage state to .auth/user.json
 *   6. Closes the browser — you're done
 */

import { test as setup, expect } from "@playwright/test"

const AUTH_FILE = ".auth/user.json"

setup("authenticate via WorkOS OAuth (manual login)", async ({ page }) => {
  // Navigate to login page
  await page.goto("/en/login")

  // Wait for the user to complete the OAuth flow.
  // After successful login, WorkOS redirects back to the app.
  // The console layout requires authentication, so landing on any
  // /en/console/* page confirms login succeeded.
  //
  // If the user is already logged in (existing session), the login
  // page redirects immediately — that's fine too.
  //
  // Timeout: 120s to give time for the full OAuth redirect dance.
  await page.waitForURL("**/console/**", { timeout: 120_000 })

  // Verify we're actually on a console page (authenticated)
  await expect(page).toHaveURL(/\/console\//)

  // Save the authenticated state (cookies + localStorage)
  await page.context().storageState({ path: AUTH_FILE })

  console.log(`\n  ✅ Auth state saved to ${AUTH_FILE}\n`)
})
