import { describe, expect, it, mock, beforeEach } from "bun:test"
import { act, fireEvent, render, waitFor } from "@testing-library/react"

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

describe("DeployPage", () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  it("renders Git Deployment Launchpad", async () => {
    const deployPageModule =
      await import("@/app/[lang]/console/app/deploy/page")
    const view = render(<deployPageModule.default />)

    expect(view.getByText("Deploy Git Repository")).toBeTruthy()
    expect(view.getByText("Git Repository URL")).toBeTruthy()
    expect(view.getByText("Connected Repositories")).toBeTruthy()
    expect(
      view.getByPlaceholderText("https://github.com/organization/repository")
    ).toBeTruthy()
  })

  it("inspects public repository and advances to build settings", async () => {
    const deployPageModule =
      await import("@/app/[lang]/console/app/deploy/page")
    const view = render(<deployPageModule.default />)

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

    expect(view.getByText("Automated Framework Detection")).toBeTruthy()
    expect(view.getByText("Build & Runtime Settings")).toBeTruthy()
  })

  it("advances to review step, verifies balance, and prevents rollout on failure", async () => {
    const deployPageModule =
      await import("@/app/[lang]/console/app/deploy/page")
    const view = render(<deployPageModule.default />)

    // Step 1: Inspect URL
    const input = view.getByPlaceholderText(
      "https://github.com/organization/repository"
    )
    await act(async () => {
      fireEvent.change(input, {
        target: { value: "https://github.com/acme/public-app" },
      })
    })
    await act(async () => {
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

    // Step 2: Build config -> Sizing
    await act(async () => {
      fireEvent.click(
        view.getByRole("button", { name: /continue to sizing & domain/i })
      )
    })

    // Step 3: Sizing -> Review
    await act(async () => {
      fireEvent.click(view.getByRole("button", { name: /review deployment/i }))
    })

    // Step 4: Review step renders, checks balance
    await waitFor(() => {
      expect(view.getByText("Balance Verified")).toBeTruthy()
      expect(view.getByText("$50.00 available")).toBeTruthy()
    })

    // Simulate deploy failure
    mockFetch.mockImplementationOnce(async (input: RequestInfo | URL) => {
      if (String(input).includes("/confirm")) {
        return new Response(
          JSON.stringify({ ok: false, message: "Insufficient quota" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        )
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    })

    await act(async () => {
      fireEvent.click(view.getByRole("button", { name: /deploy application/i }))
    })

    // On failure, should STAY on review step, NOT advance to rollout
    await waitFor(() => {
      expect(view.getByText("Deployment Specification Summary")).toBeTruthy()
      expect(view.queryByText("Deployment Rollout")).toBeNull()
    })
  })

  it("switches to connected repositories tab and lists repos", async () => {
    const deployPageModule =
      await import("@/app/[lang]/console/app/deploy/page")
    const view = render(<deployPageModule.default />)

    const connectedTabBtn = view.getByRole("button", {
      name: /connected repositories/i,
    })

    await act(async () => {
      fireEvent.click(connectedTabBtn)
    })

    await waitFor(() => {
      expect(view.getByText("juniyadi/my-ecommerce-web")).toBeTruthy()
    })
  })

  it("renders AI Agent Helper greeting and quick-pick chips", async () => {
    const deployPageModule =
      await import("@/app/[lang]/console/app/deploy/page")
    const view = render(<deployPageModule.default />)

    await waitFor(() => {
      expect(view.getByText(/what do you want to deploy today\?/i)).toBeTruthy()
    })

    // Connected repos should appear as quick-pick buttons
    await waitFor(() => {
      expect(view.getByText("my-ecommerce-web")).toBeTruthy()
    })

    // Clicking quick-pick populates input and triggers inspection
    const chip = view.getByText("my-ecommerce-web")
    await act(async () => {
      fireEvent.click(chip)
    })

    await waitFor(() => {
      expect(view.getByText("Public Repository Verified")).toBeTruthy()
    })
  })

  it("re-uses App Hosting product catalog plans in sizing step", async () => {
    const deployPageModule =
      await import("@/app/[lang]/console/app/deploy/page")
    const view = render(<deployPageModule.default />)

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

    // Advance to sizing
    await act(async () => {
      fireEvent.click(
        view.getByRole("button", { name: /continue to sizing & domain/i })
      )
    })

    // Verify catalog badge and plans from APP_HOSTING product catalog
    await waitFor(() => {
      expect(view.getByText("Catalog: APP_HOSTING")).toBeTruthy()
      expect(view.getByText("Starter Compute")).toBeTruthy()
      expect(view.getByText("Standard Compute")).toBeTruthy()
    })
  })
})
