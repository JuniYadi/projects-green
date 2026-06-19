import { defineConfig, devices, type Project } from "@playwright/test"
import path from "path"
import fs from "fs"

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3300"
const USER_AUTH_FILE = ".auth/user.json"
const ADMIN_AUTH_FILE = ".auth/admin.json"
const HAS_USER_AUTH = fs.existsSync(USER_AUTH_FILE)
const HAS_ADMIN_AUTH = fs.existsSync(ADMIN_AUTH_FILE)

const projects: Project[] = [
  // 1. Auth setup — interactive logins (run manually first)
  {
    name: "auth-setup",
    testMatch: /fixtures\/auth\.setup\.ts/,
    use: {
      ...devices["Desktop Chrome"],
      launchOptions: { headless: false },
    },
  },
  {
    name: "admin-auth-setup",
    testMatch: /fixtures\/admin-auth\.setup\.ts/,
    use: {
      ...devices["Desktop Chrome"],
      launchOptions: { headless: false },
    },
  },

  // 2. Public pages (no auth required) — landing/**/*.spec.ts
  {
    name: "public",
    testMatch: /\/landing\/.*\.spec\.ts/,
    use: { ...devices["Desktop Chrome"] },
  },
]

// 3. Console tests — dir path IS the auth signal (user role)
if (HAS_USER_AUTH) {
  projects.push({
    name: "console",
    testMatch: /\/console\/.*\.spec\.ts/,
    use: {
      ...devices["Desktop Chrome"],
      storageState: USER_AUTH_FILE,
    },
  })
}

// 4. Admin/portal tests — dir path IS the auth signal (admin role)
if (HAS_ADMIN_AUTH) {
  projects.push({
    name: "admin",
    testMatch: /\/admin\/.*\.spec\.ts/,
    use: {
      ...devices["Desktop Chrome"],
      storageState: ADMIN_AUTH_FILE,
    },
  })
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["html", { outputFolder: "playwright-report" }], ["list"]],
  use: {
    baseURL: BASE_URL,
    trace: process.env.CI ? "on-first-retry" : "on",
    screenshot: process.env.CI ? "only-on-failure" : "on",
    video: process.env.CI ? "retain-on-failure" : "off",
  },
  projects,
  webServer: {
    command: process.env.CI ? "bun run build && bun run start" : "bun run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    cwd: process.cwd(),
  },
})
