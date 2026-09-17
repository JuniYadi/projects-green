import { expect, test, type Page } from "@playwright/test"

const FUNCTIONAL_AUTH_SECRET =
  process.env.FUNCTIONAL_TEST_AUTH_SECRET?.trim() ?? ""

type MockOptions = {
  account?: Record<string, unknown>
}

async function setupAiDeployAssistantMocks(
  page: Page,
  options: MockOptions = {}
) {
  if (FUNCTIONAL_AUTH_SECRET) {
    await page.setExtraHTTPHeaders({
      "x-pfn-functional-test-auth-secret": FUNCTIONAL_AUTH_SECRET,
      "x-pfn-functional-test-role": "console",
    })
  }

  // 1. Mock session info
  await page.route("**/api/auth/session", (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      json: {
        ok: true,
        user: {
          id: "usr-e2e-tester",
          firstName: "Developer",
          name: "Developer Tester",
          email: "developer@example.com",
        },
      },
    })
  })

  // 2. Mock integrations (e.g. GitHub repos for quick picks)
  await page.route("**/api/integrations/**", (route) => {
    const url = route.request().url()
    if (url.includes("/repositories")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          ok: true,
          items: [
            {
              id: "repo-101",
              name: "sample-nextjs",
              fullName: "acme/sample-nextjs",
              defaultBranch: "main",
              isPrivate: false,
              htmlUrl: "https://github.com/acme/sample-nextjs",
            },
          ],
        },
      })
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      json: { ok: true },
    })
  })

  // 3. Mock billing endpoints
  await page.route("**/api/billing/**", (route) => {
    const url = route.request().url()
    if (url.includes("/api/billing/account")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        json: options.account ?? {
          ok: true,
          tenantId: "tenant-e2e",
          currency: "USD",
          balance: "50.00",
          formattedBalance: "$50.00",
          isAboveWarn: true,
          isPositive: true,
          accountAge: "30 days",
        },
      })
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      json: { ok: true },
    })
  })

  // 4. Mock AI deployment session lifecycle
  await page.route("**/api/deploy/ai-sessions/**", (route) => {
    const url = route.request().url()
    const method = route.request().method()

    if (url.includes("/inspect") && method === "POST") {
      let sourceUrl = ""
      try {
        const body = route.request().postDataJSON() as { sourceUrl?: string }
        sourceUrl = body?.sourceUrl || ""
      } catch {
        sourceUrl = ""
      }

      // Unhappy Path A: Private Repo Access Required
      if (sourceUrl.includes("private-core")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          json: {
            ok: true,
            data: {
              status: "access_required",
              access: {
                state: "connection_required",
                displayLabel: "Private GitHub repository",
              },
              reasonCode: "ACCESS_REQUIRED",
            },
          },
        })
      }

      // Unhappy Path B: Monorepo Disambiguation Required
      if (
        sourceUrl.includes("turborepo-monorepo") ||
        sourceUrl.includes("monorepo")
      ) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          json: {
            ok: true,
            data: {
              status: "disambiguation_required",
              isMonorepo: true,
              monorepoProjects: [
                {
                  path: "apps/web",
                  name: "apps/web",
                  framework: "Next.js 15.4",
                  description: "Frontend",
                },
                {
                  path: "services/api",
                  name: "services/api",
                  framework: "Go Gin",
                  description: "REST Backend",
                },
              ],
            },
          },
        })
      }

      // Unhappy Path D: Policy Blocked (e.g. legacy WordPress)
      if (
        sourceUrl.includes("old-wordpress-app") ||
        sourceUrl.includes("wordpress")
      ) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          json: {
            ok: true,
            data: {
              status: "blocked",
              session: {
                id: "sess-blocked-cve",
                status: "BLOCKED",
                blockedReason:
                  "RULE-BLOCK-WP-LEGACY: WordPress legacy core detected",
              },
              detection: {
                decision: {
                  status: "blocked",
                  message: "wordpress legacy cve vulnerability detected",
                  isLaunchable: false,
                },
              },
            },
          },
        })
      }

      // Unhappy Path E: Low Confidence Fallback (< 60%)
      if (sourceUrl.includes("custom-script")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          json: {
            ok: true,
            data: {
              status: "manual_override_required",
              detection: {
                primaryEngine: "Node.js 20",
                confidence: 0.42,
              },
            },
          },
        })
      }

      // Happy Path: Standard Next.js Application
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          ok: true,
          data: {
            status: "detection_success",
            access: {
              state: "public",
              displayLabel: "Public GitHub repository",
            },
            detection: {
              framework: "Next.js",
              version: "15.4",
              primaryEngine: "Node.js 20",
              buildCommand: "pnpm run build",
              startCommand: "pnpm start",
              outputDir: ".next",
              port: 3000,
              confidence: 0.96,
              decision: {
                status: "success",
                message: "Framework detected successfully.",
                isLaunchable: true,
              },
            },
            plan: {
              detection: {
                framework: "Next.js",
                version: "15.4",
                runtime: "Node.js 20",
                port: 3000,
                commands: ["pnpm build", "pnpm start"],
              },
              resources: { package: "medium" },
              domain: { hostname: "sample-nextjs" },
            },
            session: { id: "sess-happy-123" },
          },
        },
      })
    }

    if (url.includes("/chat") && method === "POST") {
      return route.fulfill({
        status: 200,
        contentType: "text/plain",
        body: "Port berhasil diubah ke 8080. Konfigurasi blueprint telah diperbarui.",
      })
    }

    if (url.includes("/confirm") && method === "POST") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          ok: true,
          data: { stackId: "stack-rollout-123" },
        },
      })
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      json: { ok: true },
    })
  })
}

test.describe("@e2e/deploy/ai-assistant/happy-path", () => {
  test("completes end-to-end deployment flow from repo URL to live rollout", async ({
    page,
  }) => {
    await setupAiDeployAssistantMocks(page)

    // 1. Navigates to deployment wizard
    await page.goto("/en/console/app/deploy")

    // 2. Verifies Tanya P welcome banner is visible
    await expect(
      page.getByText(/what do you want to deploy today/i)
    ).toBeVisible()

    // 3. Inputs repository URL into prompt bar and clicks Send
    const promptBar = page.getByTestId("deploy-prompt-bar")
    const promptInput = promptBar.getByRole("textbox")
    const sendButton = promptBar.getByRole("button", { name: /send/i })

    await promptInput.fill("https://github.com/acme/sample-nextjs")
    await sendButton.click()

    // 4. Verifies tool telemetry badges appear
    await expect(page.getByText(/list_repo_files/).first()).toBeVisible()
    await expect(page.getByText(/read_repo_file/).first()).toBeVisible()

    // 5. Verifies Inline Blueprint Proposal card appears in chat stream
    const inlineCard = page.getByTestId("inline-blueprint-card")
    await expect(inlineCard).toBeVisible()
    await expect(
      inlineCard.getByText("INLINE BLUEPRINT PROPOSAL")
    ).toBeVisible()
    await expect(inlineCard.getByText("3000 (HTTP)")).toBeVisible()

    // 6. Tests conversational tweak: user inputs "Ganti port ke 8080"
    await promptInput.fill("Ganti port ke 8080")
    await sendButton.click()

    // Verifies port updates to 8080 on the inline card
    await expect(inlineCard.getByText("8080 (HTTP)")).toBeVisible()

    // 7. Clicks [ 🚀 SIAP DEPLOY -> LANJUT KE LAUNCH CARD ]
    const readyButton = inlineCard.getByRole("button", {
      name: /SIAP DEPLOY -> LANJUT KE LAUNCH CARD/i,
    })
    await readyButton.click()

    // 8. Verifies morphing to Fase 2 Executive Launch Card
    const launchCard = page.getByTestId("executive-launch-card")
    await expect(launchCard).toBeVisible()

    // Verifies AI Verification Summary + Executive Summary Grid
    const aiSummary = page.getByTestId("ai-verification-summary")
    await expect(aiSummary).toBeVisible()
    await expect(
      aiSummary.getByText("AI AGENT VERIFICATION SUMMARY")
    ).toBeVisible()
    await expect(
      launchCard.getByText("EXECUTIVE DEPLOYMENT LAUNCH CARD")
    ).toBeVisible()
    await expect(launchCard.getByText("8080 (HTTP)")).toBeVisible()

    // 9. Tests escape hatch: clicks [ ← Kembali ke Tanya Chat ]
    const escapeButton = page.getByTestId("launch-card-escape-btn")
    await escapeButton.click()

    // Verifies return to chat with conversation history preserved
    await expect(inlineCard).toBeVisible()
    await expect(inlineCard.getByText("8080 (HTTP)")).toBeVisible()

    // 10. Returns to Launch Card and clicks [ 🚀 LAUNCH APPLICATION NOW ]
    await readyButton.click()
    await expect(launchCard).toBeVisible()

    const launchNowButton = page.getByTestId("launch-card-action-btn")
    await launchNowButton.click()

    // Verifies deployment begins and moves to rollout
    await expect(page.getByText("Deployment Rollout")).toBeVisible()
  })
})

test.describe("@e2e/deploy/ai-assistant/unhappy-auth", () => {
  test("displays Private Repo Auth Recovery Card with GitHub App and PAT options", async ({
    page,
  }) => {
    await setupAiDeployAssistantMocks(page)

    await page.goto("/en/console/app/deploy")
    await expect(
      page.getByText(/what do you want to deploy today/i)
    ).toBeVisible()

    const promptBar = page.getByTestId("deploy-prompt-bar")
    const promptInput = promptBar.getByRole("textbox")
    const sendButton = promptBar.getByRole("button", { name: /send/i })

    // Inputs private repository URL
    await promptInput.fill("https://github.com/acme/private-core")
    await sendButton.click()

    // Verifies Private Repo Auth Recovery Card appears
    const authCard = page.getByTestId("auth-recovery-card")
    await expect(authCard).toBeVisible()
    await expect(
      authCard.getByText(/AKSES REPOSITORY DIBUTUHKAN/i)
    ).toBeVisible()

    // Verifies [ 🔑 Otorisasi via GitHub App (Popup) ] button is available
    const popupBtn = authCard.getByTestId("auth-popup-btn")
    await expect(popupBtn).toBeVisible()
    await expect(popupBtn).toContainText("Otorisasi via GitHub App (Popup)")

    // Verifies [ 📋 Gunakan Personal Access Token ] toggle
    const patToggleBtn = authCard.getByTestId("auth-pat-toggle-btn")
    await expect(patToggleBtn).toBeVisible()
    await expect(patToggleBtn).toContainText("Gunakan Personal Access Token")

    // Toggles PAT input container open
    await patToggleBtn.click()
    await expect(authCard.getByTestId("pat-input-container")).toBeVisible()
    await expect(authCard.getByTestId("pat-token-input")).toBeVisible()
    await expect(authCard.getByTestId("submit-pat-btn")).toBeVisible()

    // Toggles PAT input container closed
    await patToggleBtn.click()
    await expect(authCard.getByTestId("pat-input-container")).toBeHidden()
  })
})

test.describe("@e2e/deploy/ai-assistant/unhappy-monorepo", () => {
  test("displays Monorepo Disambiguation Card and updates target on chip selection", async ({
    page,
  }) => {
    await setupAiDeployAssistantMocks(page)

    await page.goto("/en/console/app/deploy")
    await expect(
      page.getByText(/what do you want to deploy today/i)
    ).toBeVisible()

    const promptBar = page.getByTestId("deploy-prompt-bar")
    const promptInput = promptBar.getByRole("textbox")
    const sendButton = promptBar.getByRole("button", { name: /send/i })

    // Inputs monorepo URL
    await promptInput.fill("https://github.com/acme/turborepo-monorepo")
    await sendButton.click()

    // Verifies Monorepo Disambiguation Card displays quick-pick chips and custom root input
    const monorepoCard = page.getByTestId("monorepo-disambiguation-card")
    await expect(monorepoCard).toBeVisible()
    await expect(
      monorepoCard.getByText(/STRUKTUR MONOREPO \/ MULTI-APP TERDETEKSI/i)
    ).toBeVisible()
    await expect(monorepoCard.getByTestId("monorepo-chip-0")).toBeVisible()
    await expect(monorepoCard.getByTestId("monorepo-chip-1")).toBeVisible()
    await expect(
      monorepoCard.getByTestId("monorepo-custom-input")
    ).toBeVisible()
    await expect(monorepoCard.getByTestId("monorepo-apply-btn")).toBeVisible()

    // Tests selecting subproject chip updates active target
    await monorepoCard.getByTestId("monorepo-chip-0").click()

    // Verifies inline blueprint card appears configured for selected target
    const inlineCard = page.getByTestId("inline-blueprint-card")
    await expect(inlineCard).toBeVisible()
    await expect(inlineCard.getByText("apps/web.pfnapp.dev")).toBeVisible()
  })
})

test.describe("@e2e/deploy/ai-assistant/unhappy-balance", () => {
  test("renders Balance Guard deficit notice and disables Launch when balance is insufficient", async ({
    page,
  }) => {
    // Mock insufficient tenant balance ($0.10 < $0.96 buffer)
    await setupAiDeployAssistantMocks(page, {
      account: {
        ok: true,
        tenantId: "tenant-low-balance",
        currency: "USD",
        balance: "0.10",
        formattedBalance: "$0.10",
        isAboveWarn: false,
        isPositive: true,
        accountAge: "10 days",
      },
    })

    await page.goto("/en/console/app/deploy")
    await expect(
      page.getByText(/what do you want to deploy today/i)
    ).toBeVisible()

    const promptBar = page.getByTestId("deploy-prompt-bar")
    const promptInput = promptBar.getByRole("textbox")
    const sendButton = promptBar.getByRole("button", { name: /send/i })

    await promptInput.fill("https://github.com/acme/sample-nextjs")
    await sendButton.click()

    const inlineCard = page.getByTestId("inline-blueprint-card")
    await expect(inlineCard).toBeVisible()

    // Advance to Executive Launch Card
    await inlineCard
      .getByRole("button", { name: /SIAP DEPLOY -> LANJUT KE LAUNCH CARD/i })
      .click()

    const launchCard = page.getByTestId("executive-launch-card")
    await expect(launchCard).toBeVisible()

    // Verifies Balance Guard deficit notice renders
    const balanceGuard = page.getByTestId("balance-guard")
    await expect(balanceGuard).toBeVisible()
    await expect(
      balanceGuard.getByText(/VALIDASI SALDO: SALDO TIDAK MENCUKUPI/i)
    ).toBeVisible()

    // Verifies Launch button is disabled and [ 💳 TOP-UP SALDO CEPAT ] is available
    const launchNowButton = page.getByTestId("launch-card-action-btn")
    await expect(launchNowButton).toBeDisabled()

    const topUpButton = balanceGuard.getByTestId("quick-topup-btn")
    await expect(topUpButton).toBeVisible()
    await expect(topUpButton).toContainText("TOP-UP SALDO CEPAT")
  })
})

test.describe("@e2e/deploy/ai-assistant/unhappy-policy-blocked", () => {
  test("displays Policy Blocked Card and marketplace alternative when repository violates security policy", async ({
    page,
  }) => {
    await setupAiDeployAssistantMocks(page)

    await page.goto("/en/console/app/deploy")
    await expect(
      page.getByText(/what do you want to deploy today/i)
    ).toBeVisible()

    const promptBar = page.getByTestId("deploy-prompt-bar")
    const promptInput = promptBar.getByRole("textbox")
    const sendButton = promptBar.getByRole("button", { name: /send/i })

    // Inputs legacy repository that violates policy
    await promptInput.fill("https://github.com/acme/old-wordpress-app")
    await sendButton.click()

    // Verifies Policy Blocked Card appears
    const policyCard = page.getByTestId("policy-blocked-card")
    await expect(policyCard).toBeVisible()
    await expect(
      policyCard.getByText(
        /DEPLOYMENT DIBLOKIR OLEH KEBIJAKAN PLATFORM \(POLICY BLOCKED\)/i
      )
    ).toBeVisible()

    // Verifies marketplace alternative deep-link is displayed
    const marketplaceBtn = policyCard.getByTestId("policy-marketplace-btn")
    await expect(marketplaceBtn).toBeVisible()
    await expect(marketplaceBtn).toHaveAttribute(
      "href",
      "/console/app/marketplace"
    )
  })
})

test.describe("@e2e/deploy/ai-assistant/unhappy-low-confidence", () => {
  test("displays Low Confidence Fallback Card with manual override inputs", async ({
    page,
  }) => {
    await setupAiDeployAssistantMocks(page)

    await page.goto("/en/console/app/deploy")
    await expect(
      page.getByText(/what do you want to deploy today/i)
    ).toBeVisible()

    const promptBar = page.getByTestId("deploy-prompt-bar")
    const promptInput = promptBar.getByRole("textbox")
    const sendButton = promptBar.getByRole("button", { name: /send/i })

    // Inputs repository with missing manifest
    await promptInput.fill("https://github.com/acme/custom-script")
    await sendButton.click()

    // Verifies Low Confidence Fallback Card appears
    const lowConfCard = page.getByTestId("low-confidence-fallback-card")
    await expect(lowConfCard).toBeVisible()
    await expect(
      lowConfCard.getByText(/KEPASTIAN DETEKSI RENDAH/i)
    ).toBeVisible()

    // Verifies form inputs for Runtime, Start Command, Port
    await expect(
      lowConfCard.getByTestId("fallback-runtime-select")
    ).toBeVisible()
    await expect(
      lowConfCard.getByTestId("fallback-start-command-input")
    ).toBeVisible()
    await expect(lowConfCard.getByTestId("fallback-port-input")).toBeVisible()
    await expect(lowConfCard.getByTestId("fallback-save-btn")).toBeVisible()

    // Verifies saving overrides updates blueprint
    await lowConfCard.getByTestId("fallback-save-btn").click()

    const inlineCard = page.getByTestId("inline-blueprint-card")
    await expect(inlineCard).toBeVisible()
  })
})
