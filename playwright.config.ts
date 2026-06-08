import { defineConfig, devices, type Project } from "@playwright/test"
import path from "path"
import fs from "fs"

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3300"
const AUTH_FILE = path.resolve(".auth/user.json")
const HAS_AUTH_STATE = fs.existsSync(AUTH_FILE)

const projects: Project[] = [
  // 1. Auth setup — interactive login, saves storage state.
  //    Run manually: `bun run test:e2e:auth`
  //    Opens a headed browser, you log in via WorkOS OAuth,
  //    then state is saved to .auth/user.json.
  {
    name: "auth-setup",
    testMatch: /auth\.setup\.ts/,
    use: {
      ...devices["Desktop Chrome"],
      launchOptions: { headless: false },
    },
  },

  // 2. Public pages (no auth required)
  {
    name: "chromium",
    testMatch: /\.spec\.ts/,
    testIgnore: /console\..*\.spec\.ts|auth\.setup\.ts/,
    use: { ...devices["Desktop Chrome"] },
  },
]

// 3. Authenticated pages — only include if auth state exists
if (HAS_AUTH_STATE) {
  projects.push({
    name: "authenticated",
    testMatch: /console\..*\.spec\.ts/,
    use: {
      ...devices["Desktop Chrome"],
      storageState: AUTH_FILE,
    },
  })
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["html", { outputFolder: "playwright-report" }],
    ["list"],
  ],
  use: {
    baseURL: BASE_URL,
    trace: process.env.CI ? "on-first-retry" : "on",
    screenshot: process.env.CI ? "only-on-failure" : "on",
    video: process.env.CI ? "retain-on-failure" : "off",
  },
  projects,
  webServer: {
    command: process.env.CI
      ? "bun run build && bun run start"
      : "bun run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    cwd: process.cwd(),
  },
})
