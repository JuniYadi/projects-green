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
import fs from "fs"
import path from "path"

const AUTH_FILE = path.resolve(process.cwd(), ".auth/admin.json")

setup(
  "authenticate as admin via WorkOS OAuth (manual login)",
  async ({ page }) => {
    // The Playwright test timeout also covers this interactive setup. Keep the
    // browser open long enough for email OTP delivery and manual entry.
    setup.setTimeout(10 * 60 * 1000)

    fs.mkdirSync(".auth", { recursive: true })

    await page.goto("/en/login")

    // WorkOS may return either `/en/portal` or a nested portal page.
    // The previous `**/portal/**` pattern required a trailing slash and never
    // completed when the redirect landed on the portal root.
    await page.waitForURL(/\/portal(?:\/|$)/, { timeout: 10 * 60 * 1000 })
    await expect(page).toHaveURL(/\/portal(?:\/|$)/)
    await page.context().storageState({ path: AUTH_FILE })

    console.log(
      `\n  ✅ Admin auth state saved to ${AUTH_FILE} (${fs.statSync(AUTH_FILE).size} bytes)\n`
    )
  }
)
