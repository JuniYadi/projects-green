import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react"
import DeployPageClient from "./page-client"

const mockInspectResponse = {
  ok: true,
  data: {
    status: "detection_success",
    access: {
      state: "public",
      displayLabel: "Public GitHub repository",
    },
    detection: {
      framework: "Next.js",
      version: "14.2.3",
      primaryEngine: "Node.js 20",
      buildCommand: "pnpm run build",
      startCommand: "pnpm start",
      outputDir: ".next",
      port: 3000,
      confidence: 0.95,
      evidence: [],
    },
    plan: null,
    session: { id: "sess-123" },
  },
}

const mockFetch = mock(
  async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input)
    if (url.includes("/api/auth/session")) {
      return new Response(
        JSON.stringify({
          ok: true,
          user: { id: "user-1", firstName: "Alex" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }
    if (url.includes("/api/billing/catalog/APP_HOSTING")) {
      return new Response(
        JSON.stringify({
          ok: true,
          product: {
            code: "APP_HOSTING",
            name: "App Hosting Compute",
            plans: [
              {
                code: "SMALL",
                name: "Starter Compute",
                description: "Lightweight apps",
                resources: { cpu: 250, memory: 512 },
                offers: [
                  {
                    billingPeriod: "MONTHLY",
                    periodPrice: "15.00",
                    currency: "USD",
                  },
                ],
              },
              {
                code: "MEDIUM",
                name: "Standard Compute",
                description: "Production web apps",
                resources: { cpu: 500, memory: 1024 },
                offers: [
                  {
                    billingPeriod: "MONTHLY",
                    periodPrice: "30.00",
                    currency: "USD",
                  },
                ],
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }
    if (url.includes("/api/deploy/ai-sessions/inspect")) {
      return new Response(JSON.stringify(mockInspectResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }
    if (url.includes("/api/integrations/github/repositories")) {
      return new Response(
        JSON.stringify({
          ok: true,
          items: [
            {
              id: "1",
              name: "my-ecommerce-web",
              fullName: "juniyadi/my-ecommerce-web",
              defaultBranch: "main",
              isPrivate: true,
              htmlUrl: "https://github.com/juniyadi/my-ecommerce-web",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }
    if (url.includes("/api/billing/account")) {
      return new Response(
        JSON.stringify({
          ok: true,
          formattedBalance: "$50.00",
          balance: "50.00",
          isPositive: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }
    if (url.includes("/confirm")) {
      return new Response(
        JSON.stringify({
          ok: true,
          data: { stackId: "stack-new" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }
)

globalThis.fetch = mockFetch as unknown as typeof fetch

describe("DeployPage Client", () => {
  afterEach(cleanup)

  beforeEach(() => {
    mockFetch.mockClear()
  })

  it("renders Tanya P Chat-First Deploy Assistant (Fase 1)", async () => {
    const view = render(<DeployPageClient initialUserName="Alex" lang="en" />)

    expect(
      view.getByText("Hi Alex, what do you want to deploy today?")
    ).toBeTruthy()
    expect(view.getByRole("textbox")).toBeTruthy()
    expect(view.getByRole("button", { name: /send/i })).toBeTruthy()

    // Wait for organization repositories quick-picks to load
    await waitFor(() => {
      expect(view.getByText("my-ecommerce-web")).toBeTruthy()
    })
  })

  it("inspects public repository and transitions to AI Deployment Summary (Screen 2)", async () => {
    const view = render(<DeployPageClient initialUserName="Alex" lang="en" />)

    const input = view.getByRole("textbox")

    await act(async () => {
      fireEvent.change(input, {
        target: { value: "https://github.com/acme/public-app" },
      })
      fireEvent.keyDown(input, { key: "Enter", shiftKey: false })
    })

    await waitFor(() => {
      expect(view.getByText(/Public Repository Verified/i)).toBeTruthy()
      expect(view.getByTestId("inline-blueprint-card")).toBeTruthy()
    })

    const continueBtn = view.getByRole("button", {
      name: /SIAP DEPLOY -> LANJUT KE LAUNCH CARD/i,
    })

    await act(async () => {
      fireEvent.click(continueBtn)
    })

    // Screen 2: Executive Launch Card
    await waitFor(() => {
      const launchCard = view.getByTestId("executive-launch-card")
      expect(launchCard).toBeTruthy()
      expect(
        within(launchCard).getByText("EXECUTIVE DEPLOYMENT LAUNCH CARD")
      ).toBeTruthy()
      expect(
        within(launchCard).getByText("AI AGENT VERIFICATION SUMMARY")
      ).toBeTruthy()
      expect(
        within(launchCard).getByText("Next.js 14.2.3 (Node.js 20)")
      ).toBeTruthy()
      expect(within(launchCard).getByText("3000 (HTTP)")).toBeTruthy()
    })
  })

  it("displays zero-config notice and returns to chat with conversation intact via escape hatch", async () => {
    const view = render(<DeployPageClient initialUserName="Alex" lang="en" />)

    // Step 1: inspect in chat
    const input = view.getByRole("textbox")
    await act(async () => {
      fireEvent.change(input, {
        target: { value: "https://github.com/acme/public-app" },
      })
      fireEvent.keyDown(input, { key: "Enter", shiftKey: false })
    })

    await waitFor(() => {
      expect(view.getByText(/Public Repository Verified/i)).toBeTruthy()
    })

    await act(async () => {
      fireEvent.click(
        view.getByRole("button", {
          name: /SIAP DEPLOY -> LANJUT KE LAUNCH CARD/i,
        })
      )
    })

    // Screen 2: verify zero-config notice and tenant balance
    await waitFor(() => {
      expect(view.getByTestId("zero-config-badge")).toBeTruthy()
      expect(view.getByText("Zero-Config Ready")).toBeTruthy()
      expect(
        view.getByText(/variables auto-configured from \.env\.example/i)
      ).toBeTruthy()
      expect(
        view.getByText(
          /\(Production secrets can be configured anytime in App Settings\)/i
        )
      ).toBeTruthy()
      expect(
        view.getByText(/\(Verified ✓ Cukup untuk peluncuran\)/i)
      ).toBeTruthy()
    })

    // Test escape hatch
    const escapeBtn = view.getByRole("button", {
      name: /Kembali ke Tanya Chat/i,
    })
    await act(async () => {
      fireEvent.click(escapeBtn)
    })

    // Should return to Screen 1 (Chat Stream) with conversation preserved
    await waitFor(() => {
      expect(
        view.getByText("Hi Alex, what do you want to deploy today?")
      ).toBeTruthy()
      expect(view.getByTestId("inline-blueprint-card")).toBeTruthy()
    })
  })

  it("triggers deployment from Screen 2 and advances to Flight Deck", async () => {
    const view = render(<DeployPageClient initialUserName="Alex" lang="en" />)

    const input = view.getByRole("textbox")
    await act(async () => {
      fireEvent.change(input, {
        target: { value: "https://github.com/acme/public-app" },
      })
      fireEvent.keyDown(input, { key: "Enter", shiftKey: false })
    })

    await waitFor(() => {
      expect(view.getByText(/Public Repository Verified/i)).toBeTruthy()
    })

    await act(async () => {
      fireEvent.click(
        view.getByRole("button", {
          name: /SIAP DEPLOY -> LANJUT KE LAUNCH CARD/i,
        })
      )
    })

    await waitFor(() => {
      expect(view.getByTestId("executive-launch-card")).toBeTruthy()
    })

    const deployBtn = view.getByRole("button", {
      name: /LAUNCH APPLICATION NOW/i,
    })

    await act(async () => {
      fireEvent.click(deployBtn)
    })

    // Advances to live rollout flight deck
    await waitFor(() => {
      expect(view.getByText("Deployment Rollout")).toBeTruthy()
    })
  })

  it("supports zero-config launch without requiring manual secret entry upfront", async () => {
    const view = render(<DeployPageClient initialUserName="Alex" lang="en" />)

    const input = view.getByRole("textbox")
    await act(async () => {
      fireEvent.change(input, {
        target: { value: "https://github.com/acme/public-app" },
      })
      fireEvent.keyDown(input, { key: "Enter", shiftKey: false })
    })

    await waitFor(() => {
      expect(view.getByText(/Public Repository Verified/i)).toBeTruthy()
    })

    await act(async () => {
      fireEvent.click(
        view.getByRole("button", {
          name: /SIAP DEPLOY -> LANJUT KE LAUNCH CARD/i,
        })
      )
    })

    await waitFor(() => {
      expect(view.getByTestId("executive-launch-card")).toBeTruthy()
    })

    const deployButton = view.getByRole("button", {
      name: /LAUNCH APPLICATION NOW/i,
    })

    // Launch button is enabled and ready without entering secrets
    expect(deployButton).not.toBeDisabled()
    expect(
      view.getByText("3 variables auto-configured from .env.example")
    ).toBeTruthy()
  })

  it("renders Indonesian localized greeting and labels when lang is id", async () => {
    const view = render(<DeployPageClient initialUserName="Alex" lang="id" />)

    expect(
      view.getByText("Halo Alex, apa yang ingin Anda deploy hari ini?")
    ).toBeTruthy()

    await waitFor(() => {
      expect(view.getByText("Repositori Terhubung:")).toBeTruthy()
    })
  })

  it("handles balance failure gracefully with unknown balance badge", async () => {
    mockFetch.mockImplementation(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = String(input)
        if (url.includes("/api/billing/account")) {
          return new Response(
            JSON.stringify({ ok: false, message: "Service unavailable" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          )
        }
        if (url.includes("/api/deploy/ai-sessions/inspect")) {
          return new Response(JSON.stringify(mockInspectResponse), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        }
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
    )

    const view = render(<DeployPageClient initialUserName="Alex" lang="en" />)
    const input = view.getByRole("textbox")

    await act(async () => {
      fireEvent.change(input, {
        target: { value: "https://github.com/acme/public-app" },
      })
      fireEvent.keyDown(input, { key: "Enter", shiftKey: false })
    })

    await waitFor(() => {
      expect(view.getByText(/Public Repository Verified/i)).toBeTruthy()
      expect(view.getByTestId("inline-blueprint-card")).toBeTruthy()
    })

    const continueBtn = view.getByRole("button", {
      name: /SIAP DEPLOY -> LANJUT KE LAUNCH CARD/i,
    })

    await act(async () => {
      fireEvent.click(continueBtn)
    })

    await waitFor(() => {
      expect(view.getByText("Could Not Verify Balance")).toBeTruthy()
    })
  })

  it("correctly resolves Laravel detection with AI Copilot card and tailored commands", async () => {
    const mockLaravelInspectResponse = {
      ok: true,
      data: {
        status: "plan_ready",
        access: {
          state: "public",
          displayLabel: "Public GitHub repository",
        },
        source: {
          url: "https://github.com/laravel/laravel",
          host: "github.com",
          owner: "laravel",
          repo: "laravel",
          ref: "main",
          subdir: "./",
        },
        detection: {
          primaryFramework: {
            id: "laravel",
            name: "Laravel",
            ecosystem: "php",
            points: 100,
            confidence: 1,
            reasons: ["composer.json is present", "artisan entrypoint exists"],
          },
          requiredDependencies: [
            { id: "php", name: "PHP", version: "8.2", kind: "runtime" },
          ],
          alternatives: [],
          confidence: 0.98,
          decision: {
            status: "success",
            message: "Supported",
            isLaunchable: true,
          },
          evidence: [],
          warnings: [],
          source: {
            repoUrl: "https://github.com/laravel/laravel",
            ref: "main",
          },
          frameworkVersion: "11.x",
          defaultPort: 8000,
          enforcedRuntimes: [],
        },
        plan: {
          version: 1,
          source: {
            kind: "git",
            url: "https://github.com/laravel/laravel",
            ref: "main",
          },
          access: { state: "public" },
          detection: {
            runtime: "php",
            framework: "laravel",
            version: "11.x",
            commands: [
              "composer install --no-dev --optimize-autoloader",
              "php artisan serve --host=0.0.0.0 --port=8000",
            ],
            port: 8000,
            confidence: 0.98,
            evidence: [],
          },
          resources: { package: "medium", cpu: 1000, memory: 2048 },
          domain: { mode: "auto", hostname: "laravel", tls: true },
        },
        session: { id: "sess-laravel" },
      },
    }

    mockFetch.mockImplementation(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = String(input)
        if (url.includes("/api/deploy/ai-sessions/inspect")) {
          return new Response(JSON.stringify(mockLaravelInspectResponse), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        }
        if (url.includes("/api/billing/catalog/APP_HOSTING")) {
          return new Response(
            JSON.stringify({
              ok: true,
              product: {
                code: "APP_HOSTING",
                plans: [
                  {
                    code: "MEDIUM",
                    name: "Standard Compute",
                    resources: { cpu: 1000, memory: 2048 },
                    offers: [
                      {
                        billingPeriod: "MONTHLY",
                        periodPrice: "40.00",
                        currency: "USD",
                      },
                    ],
                  },
                ],
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
    )

    const view = render(<DeployPageClient initialUserName="Alex" lang="en" />)
    const input = view.getByRole("textbox")

    await act(async () => {
      fireEvent.change(input, {
        target: { value: "https://github.com/laravel/laravel" },
      })
      fireEvent.keyDown(input, { key: "Enter", shiftKey: false })
    })

    await waitFor(() => {
      expect(view.getByText(/Public Repository Verified/i)).toBeTruthy()
    })

    await act(async () => {
      fireEvent.click(
        view.getByRole("button", {
          name: /SIAP DEPLOY -> LANJUT KE LAUNCH CARD/i,
        })
      )
    })

    // Screen 2: Executive Launch Card for Laravel stack
    await waitFor(() => {
      const launchCard = view.getByTestId("executive-launch-card")
      expect(launchCard).toBeTruthy()
      expect(
        within(launchCard).getByText("EXECUTIVE DEPLOYMENT LAUNCH CARD")
      ).toBeTruthy()
      expect(
        within(launchCard).getByText(
          "Verified via GitHub Adapter (github.com/laravel/laravel)"
        )
      ).toBeTruthy()
      expect(
        within(launchCard).getByText("Laravel 11.x (PHP 8.2)")
      ).toBeTruthy()
      expect(within(launchCard).getByText("8000 (HTTP)")).toBeTruthy()
      expect(
        within(launchCard).getByText(
          "12 variables auto-configured from .env.example"
        )
      ).toBeTruthy()
      expect(
        within(launchCard).getByText(
          "Medium Tier (1 vCPU · 2GB RAM · $0.04/hour)"
        )
      ).toBeTruthy()
    })
  })

  it("correctly resolves Vite React with tailored Executive Launch Card", async () => {
    const mockViteInspectResponse = {
      ok: true,
      data: {
        status: "plan_ready",
        access: {
          state: "public",
          displayLabel: "Public GitHub repository",
        },
        source: {
          url: "https://github.com/pfnapp/example-vite-react",
          host: "github.com",
          owner: "pfnapp",
          repo: "example-vite-react",
          ref: "main",
          subdir: "./",
        },
        detection: {
          primaryFramework: {
            id: "react",
            name: "React",
            ecosystem: "node",
            confidence: 0.6,
            reasons: ["package.json is present", "react dependency is present"],
          },
          requiredDependencies: [
            { id: "node", name: "Node.js", version: "20", kind: "runtime" },
          ],
          alternatives: [],
          confidence: 0.6,
          decision: {
            status: "success",
            message: "Ready to deploy.",
            isLaunchable: true,
          },
          evidence: [],
          warnings: [],
          source: {
            repoUrl: "https://github.com/pfnapp/example-vite-react",
            ref: "main",
          },
          frameworkVersion: "19.1",
          defaultPort: 3000,
          enforcedRuntimes: [],
        },
        plan: {
          version: 1,
          source: {
            kind: "git",
            url: "https://github.com/pfnapp/example-vite-react",
            ref: "main",
          },
          access: { state: "public" },
          detection: {
            runtime: "node",
            framework: "react",
            version: "19.1",
            commands: [],
            port: 3000,
            confidence: 0.6,
            evidence: [],
          },
          resources: { package: "medium", cpu: 500, memory: 1024 },
          domain: { mode: "auto", hostname: "example-vite-react", tls: true },
        },
        session: { id: "sess-vite" },
      },
    }

    mockFetch.mockImplementation(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = String(input)
        if (url.includes("/api/deploy/ai-sessions/inspect")) {
          return new Response(JSON.stringify(mockViteInspectResponse), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        }
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
    )

    const view = render(<DeployPageClient initialUserName="Alex" lang="en" />)
    const input = view.getByRole("textbox")

    await act(async () => {
      fireEvent.change(input, {
        target: { value: "https://github.com/pfnapp/example-vite-react" },
      })
      fireEvent.keyDown(input, { key: "Enter", shiftKey: false })
    })

    await waitFor(() => {
      expect(view.getByText(/Public Repository Verified/i)).toBeTruthy()
    })

    await act(async () => {
      fireEvent.click(
        view.getByRole("button", {
          name: /SIAP DEPLOY -> LANJUT KE LAUNCH CARD/i,
        })
      )
    })

    await waitFor(() => {
      const launchCard = view.getByTestId("executive-launch-card")
      expect(launchCard).toBeTruthy()
      expect(
        within(launchCard).getByText("EXECUTIVE DEPLOYMENT LAUNCH CARD")
      ).toBeTruthy()
      expect(
        within(launchCard).getByText(
          "Verified via GitHub Adapter (github.com/pfnapp/example-vite-react)"
        )
      ).toBeTruthy()
      expect(
        within(launchCard).getByText("React 19.1 (Node.js 20)")
      ).toBeTruthy()
      expect(within(launchCard).getByText("3000 (HTTP)")).toBeTruthy()
      expect(within(launchCard).getByTestId("zero-config-badge")).toBeTruthy()
    })
  })

  it("shows inspection failure banner when framework is blocked or unsupported by detector rule", async () => {
    const mockUnsupportedResponse = {
      ok: true,
      data: {
        status: "blocked",
        access: {
          state: "public",
          displayLabel: "Public GitHub repository",
        },
        source: {
          url: "https://github.com/unknown/unsupported-app",
          host: "github.com",
          owner: "unknown",
          repo: "unsupported-app",
          ref: "main",
          subdir: "./",
        },
        detection: {
          primaryFramework: {
            id: "ruby",
            name: "Ruby on Rails",
            ecosystem: "ruby",
            confidence: 0.9,
          },
          confidence: 0.9,
          decision: {
            status: "unsupported",
            message:
              "Your framework was detected as Ruby on Rails, but we currently only support laravel, nextjs.",
            isLaunchable: false,
          },
        },
        session: {
          id: "sess-blocked",
          status: "BLOCKED",
          blockedReason:
            "Your framework was detected as Ruby on Rails, but we currently only support laravel, nextjs.",
        },
      },
    }

    mockFetch.mockImplementation(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = String(input)
        if (url.includes("/api/deploy/ai-sessions/inspect")) {
          return new Response(JSON.stringify(mockUnsupportedResponse), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        }
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
    )

    const view = render(<DeployPageClient initialUserName="Alex" lang="en" />)
    const input = view.getByRole("textbox")

    await act(async () => {
      fireEvent.change(input, {
        target: { value: "https://github.com/unknown/unsupported-app" },
      })
      fireEvent.keyDown(input, { key: "Enter", shiftKey: false })
    })

    await waitFor(() => {
      expect(view.getByText("Inspection Failed")).toBeTruthy()
      expect(
        view.getByText(
          /Your framework was detected as Ruby on Rails, but we currently only support laravel, nextjs./i
        )
      ).toBeTruthy()
      expect(
        view.queryByText("SIAP DEPLOY -> LANJUT KE LAUNCH CARD")
      ).toBeNull()
    })
  })
})
