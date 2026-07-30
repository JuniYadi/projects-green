import { expect, test, type Browser, type Page } from "@playwright/test"

const repositories = {
  ok: true,
  owners: [
    {
      id: "pfn",
      name: "PFN",
      avatarUrl: null,
    },
  ],
  items: [
    {
      repositoryId: 101,
      name: "green-app",
      owner: "pfn",
      defaultBranch: "main",
      private: false,
      installationId: "501",
    },
  ],
}

const detection = {
  ok: true,
  primaryFramework: {
    id: "nextjs-v16",
    name: "Next.js",
    ecosystem: "node",
    confidence: 98,
    reasons: ["Found next.config.ts"],
  },
  requiredDependencies: [],
  alternatives: [],
  confidence: 98,
  decision: {
    status: "success",
    message: "Framework detected successfully.",
    isLaunchable: true,
  },
  evidence: [
    {
      type: "file",
      value: "next.config.ts",
      detail: "root",
    },
  ],
  warnings: [],
  source: {
    repoUrl: "https://github.com/pfn/green-app",
  },
  defaultPort: 3000,
}

const runningStatus = {
  ok: true,
  data: {
    status: "running",
    failureReason: null,
    startedAt: "2026-07-30T00:00:00.000Z",
    completedAt: "2026-07-30T00:01:00.000Z",
  },
}

const installDeployFixtures = async (
  page: Page,
  submit: (attempt: number) => {
    status: number
    body: Record<string, unknown>
  }
) => {
  let submitAttempt = 0

  await page.route("**/api/integrations/github/repositories?**", (route) => {
    return route.fulfill({ status: 200, json: repositories })
  })
  await page.route("**/api/framework-detection/github", (route) => {
    return route.fulfill({ status: 200, json: detection })
  })
  await page.route("**/api/deploy/submit", (route) => {
    submitAttempt++
    const response = submit(submitAttempt)
    return route.fulfill({
      status: response.status,
      json: response.body,
    })
  })
  await page.route("**/api/deploy/status/**", (route) => {
    return route.fulfill({ status: 200, json: runningStatus })
  })
  await page.route("**/api/deploy/events/**", (route) => {
    return route.fulfill({ status: 200, json: { ok: true, data: [] } })
  })
  await page.route("**/api/deploy/logs/**", (route) => {
    return route.fulfill({ status: 200, json: { ok: true, data: [] } })
  })
}

const configureDeploy = async (page: Page) => {
  await page.goto("/en/console/app/deploy?github=connected")
  await expect(
    page.getByRole("heading", { name: "Deploy Application" })
  ).toBeVisible()

  await expect(page.getByText("PFN", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: /green-app/ }).click()
  await expect(page.getByText("Next.js", { exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Next" }).click()
  await expect(
    page.getByText("Build Configuration", { exact: true })
  ).toBeVisible()
  await page.getByRole("button", { name: "Next" }).click()
  await expect(page.getByText("Domain Mode", { exact: true })).toBeVisible()
}

const expectNormalAuthentication = async (
  browser: Browser,
  secret?: string
) => {
  const context = await browser.newContext({
    extraHTTPHeaders: secret
      ? {
          "x-pfn-functional-test-auth-secret": secret,
          "x-pfn-functional-test-role": "console",
        }
      : {},
  })
  const page = await context.newPage()
  await page.goto("/en/console/app/deploy")
  await expect(page).toHaveURL(/\/en\/login\?next=/)
  await context.close()
}

test("uses normal authentication without functional credentials", async ({
  browser,
}) => {
  await expectNormalAuthentication(browser)
})

test("uses normal authentication with an incorrect functional secret", async ({
  browser,
}) => {
  await expectNormalAuthentication(browser, "incorrect-secret")
})

test("deploys a repository through the happy path", async ({ page }) => {
  await installDeployFixtures(page, () => ({
    status: 200,
    body: {
      ok: true,
      data: {
        deploymentId: "deploy-smoke-happy",
        status: "queued",
      },
    },
  }))

  await configureDeploy(page)
  await page.getByRole("button", { name: "Deploy Application" }).click()

  await expect(page.getByText("Deployment live")).toBeVisible()
})

test("shows a submit error and completes after retry", async ({ page }) => {
  await installDeployFixtures(page, (attempt) => {
    if (attempt === 1) {
      return {
        status: 503,
        body: {
          ok: false,
          message: "Deployment service is temporarily unavailable.",
        },
      }
    }

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          deploymentId: "deploy-smoke-retry",
          status: "queued",
        },
      },
    }
  })

  await configureDeploy(page)
  const deployButton = page.getByRole("button", {
    name: "Deploy Application",
  })
  await deployButton.click()

  await expect(page.getByRole("alert")).toContainText(
    "Deployment service is temporarily unavailable."
  )
  await expect(deployButton).toBeEnabled()

  await deployButton.click()
  await expect(page.getByText("Deployment live")).toBeVisible()
})
