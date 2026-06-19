/**
 * Playwright admin auth setup — interactive login via WorkOS OAuth.
 *
 * Run once per session to save admin browser state to `.auth/admin.json`.
 * All tests in the "admin" project load this state automatically.
 *
 * Usage:
 *   bun run test:e2e:admin-auth    # interactive (opens headed browser)
 *   bun run test:e2e               # runs admin tests if .auth/admin.json exists
 *
 * The flow:
 *   1. Opens Chromium headed
 *   2. Navigates to /en/login
 *   3. YOU sign in via WorkOS as an admin/owner/super_admin
 *   4. After redirect back, Playwright detects the console URL
 *   5. Saves storage state to .auth/admin.json
 *   6. Closes the browser
 */

import { test as setup, expect } from "@playwright/test"

const AUTH_FILE = ".auth/admin.json"

setup("authenticate as admin via WorkOS OAuth (manual login)", async ({ page }) => {
  await page.goto("/en/login")

  // Wait for the user to complete the OAuth flow and land on a console page.
  await page.waitForURL("**/console/**", { timeout: 120_000 })
  await expect(page).toHaveURL(/\/console\//)

  await page.context().storageState({ path: AUTH_FILE })

  console.log(`\n  ✅ Admin auth state saved to ${AUTH_FILE}\n`)
})
