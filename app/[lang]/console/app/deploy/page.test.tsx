import { describe, expect, it, mock, beforeEach } from "bun:test"
import { act, fireEvent, render, waitFor } from "@testing-library/react"
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
  beforeEach(() => {
    mockFetch.mockClear()
  })

  it("renders Centered AI Agent Hero & Intake (Screen 1)", async () => {
    const view = render(<DeployPageClient initialUserName="Alex" lang="en" />)

    expect(
      view.getByText("Hi Alex, what do you want to deploy today?")
    ).toBeTruthy()
    expect(
      view.getByPlaceholderText("https://github.com/organization/repository")
    ).toBeTruthy()
    expect(
      view.getByRole("button", { name: /inspect repository/i })
    ).toBeTruthy()

    // Wait for organization repositories quick-picks to load
    await waitFor(() => {
      expect(view.getByText("my-ecommerce-web")).toBeTruthy()
    })
  })

  it("inspects public repository and transitions to AI Deployment Summary (Screen 2)", async () => {
    const view = render(<DeployPageClient initialUserName="Alex" lang="en" />)

    const input = view.getByPlaceholderText(
      "https://github.com/organization/repository"
    )

    await act(async () => {
      fireEvent.change(input, {
        target: { value: "https://github.com/acme/public-app" },
      })
    })

    const inspectBtn = view.getByRole("button", {
      name: /inspect repository/i,
    })

    await act(async () => {
      fireEvent.click(inspectBtn)
    })

    await waitFor(() => {
      expect(view.getByText("Public Repository Verified")).toBeTruthy()
    })

    const continueBtn = view.getByRole("button", {
      name: /continue to build settings/i,
    })

    await act(async () => {
      fireEvent.click(continueBtn)
    })

    // Screen 2: AI Deployment Summary
    await waitFor(() => {
      expect(view.getByText("Deployment Summary")).toBeTruthy()
      expect(
        view.getByText("Review and adjust your configuration before launching.")
      ).toBeTruthy()
      expect(view.getByText("Next.js 14.2.3")).toBeTruthy()
      expect(view.getByText("Node.js 20")).toBeTruthy()
    })
  })

  it("allows environment variable management and compute sizing selection on Screen 2", async () => {
    const view = render(<DeployPageClient initialUserName="Alex" lang="en" />)

    // Step 1: inspect
    const input = view.getByPlaceholderText(
      "https://github.com/organization/repository"
    )
    await act(async () => {
      fireEvent.change(input, {
        target: { value: "https://github.com/acme/public-app" },
      })
      fireEvent.click(view.getByRole("button", { name: /inspect repository/i }))
    })

    await waitFor(() => {
      expect(view.getByText("Public Repository Verified")).toBeTruthy()
    })

    await act(async () => {
      fireEvent.click(
        view.getByRole("button", { name: /continue to build settings/i })
      )
    })

    // Screen 2: verify balance and add env variable
    await waitFor(() => {
      expect(view.getByText("Balance Verified")).toBeTruthy()
      expect(view.getByText("$50.00 available")).toBeTruthy()
    })

    // Add env var
    const keyInput = view.getByPlaceholderText("VARIABLE_NAME")
    const valInput = view.getByPlaceholderText("Value")
    const addBtn = view.getByRole("button", { name: /add variable/i })

    await act(async () => {
      fireEvent.change(keyInput, { target: { value: "DATABASE_URL" } })
      fireEvent.change(valInput, {
        target: { value: "postgres://user:pass@host/db" },
      })
      fireEvent.click(addBtn)
    })

    expect(view.getByText("DATABASE_URL")).toBeTruthy()
    expect(view.getByText("1 variable configured")).toBeTruthy()

    // Test start over
    const startOverBtn = view.getByRole("button", { name: /start over/i })
    await act(async () => {
      fireEvent.click(startOverBtn)
    })

    // Should return to Screen 1
    expect(
      view.getByText("Hi Alex, what do you want to deploy today?")
    ).toBeTruthy()
  })

  it("triggers deployment from Screen 2 and advances to Flight Deck", async () => {
    const view = render(<DeployPageClient initialUserName="Alex" lang="en" />)

    const input = view.getByPlaceholderText(
      "https://github.com/organization/repository"
    )
    await act(async () => {
      fireEvent.change(input, {
        target: { value: "https://github.com/acme/public-app" },
      })
      fireEvent.click(view.getByRole("button", { name: /inspect repository/i }))
    })

    await waitFor(() => {
      expect(view.getByText("Public Repository Verified")).toBeTruthy()
    })

    await act(async () => {
      fireEvent.click(
        view.getByRole("button", { name: /continue to build settings/i })
      )
    })

    await waitFor(() => {
      expect(view.getByText("Deployment Summary")).toBeTruthy()
    })

    const deployBtn = view.getByRole("button", {
      name: /deploy application now/i,
    })

    await act(async () => {
      fireEvent.click(deployBtn)
    })

    // Advances to live rollout flight deck
    await waitFor(() => {
      expect(view.getByText("Deployment Rollout")).toBeTruthy()
    })
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
})
