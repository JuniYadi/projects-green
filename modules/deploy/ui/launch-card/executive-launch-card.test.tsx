import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { ExecutiveLaunchCard } from "./executive-launch-card"

const mockFetch = mock(
  async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input)
    if (url.includes("/api/billing/account")) {
      return new Response(
        JSON.stringify({
          ok: true,
          formattedBalance: "IDR 14.493.579,66",
          balance: "14493579.66",
          isPositive: true,
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

describe("ExecutiveLaunchCard", () => {
  afterEach(cleanup)

  beforeEach(() => {
    mockFetch.mockClear()
    mockFetch.mockImplementation(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = String(input)
        if (url.includes("/api/billing/account")) {
          return new Response(
            JSON.stringify({
              ok: true,
              formattedBalance: "IDR 14.493.579,66",
              balance: "14493579.66",
              isPositive: true,
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
  })

  const sampleSource = {
    url: "https://gitlab.com/acme/api.git",
    branch: "main",
    rootDir: "./",
    isPrivate: false,
  }

  const sampleBlueprint = {
    framework: "Laravel 11.x",
    runtime: "PHP 8.2",
    port: 8000,
    computeTier: "Medium",
    subdomain: "backend-api",
    startCommand: "php artisan serve",
    envVarsCount: 12,
    hourlyRate: 0.04,
  }

  it("renders AI AGENT VERIFICATION SUMMARY matching visual spec", async () => {
    const onLaunch = mock(() => {})
    const onBackToChat = mock(() => {})

    const view = render(
      <ExecutiveLaunchCard
        source={sampleSource}
        blueprint={sampleBlueprint}
        balanceFormatted="IDR 14.493.579,66"
        inspectionData={{
          detection: { confidence: 0.96 },
        }}
        onLaunch={onLaunch}
        onBackToChat={onBackToChat}
      />
    )

    // Top Section
    expect(view.getByText("AI AGENT VERIFICATION SUMMARY")).toBeTruthy()
    expect(
      view.getByText("Verified via GitLab Adapter (gitlab.com/acme/api)")
    ).toBeTruthy()
    expect(
      view.getByText("Tools executed: list_repo_files, read_repo_file")
    ).toBeTruthy()
    expect(
      view.getByText("AI Confidence: 96% · Production-ready configuration")
    ).toBeTruthy()
  })

  it("renders EXECUTIVE DEPLOYMENT LAUNCH CARD main grid accurately", async () => {
    const onLaunch = mock(() => {})
    const onBackToChat = mock(() => {})

    const view = render(
      <ExecutiveLaunchCard
        source={sampleSource}
        blueprint={sampleBlueprint}
        currency="IDR"
        onLaunch={onLaunch}
        onBackToChat={onBackToChat}
      />
    )

    expect(view.getByText("EXECUTIVE DEPLOYMENT LAUNCH CARD")).toBeTruthy()
    expect(view.getByText("Target Stack:")).toBeTruthy()
    expect(view.getByText("Laravel 11.x (PHP 8.2)")).toBeTruthy()
    expect(view.getByText("Listen Port:")).toBeTruthy()
    expect(view.getByText("8000 (HTTP)")).toBeTruthy()
    expect(view.getByText("Branch / Dir:")).toBeTruthy()
    expect(view.getByText("main / ./")).toBeTruthy()
    expect(view.getByText("Subdomain:")).toBeTruthy()
    expect(view.getByText("backend-api")).toBeTruthy()
    expect(view.getByText("Compute Plan:")).toBeTruthy()
    expect(
      view.getByText("Medium Tier (1 vCPU · 2GB RAM · $0.04/hour)")
    ).toBeTruthy()

    // Balance check
    await waitFor(() => {
      expect(view.getByText(/IDR 14\.493\.579,66/i)).toBeTruthy()
      expect(
        view.getByText(/\(Verified ✓ Cukup untuk peluncuran\)/i)
      ).toBeTruthy()
    })

    // Zero Config Notice embedded
    expect(
      view.getByText("12 variables auto-configured from .env.example")
    ).toBeTruthy()
  })

  it("triggers onLaunch when primary green launch button is clicked", async () => {
    const onLaunch = mock(async () => {})
    const onBackToChat = mock(() => {})

    const view = render(
      <ExecutiveLaunchCard
        source={sampleSource}
        blueprint={sampleBlueprint}
        balanceFormatted="IDR 14.493.579,66"
        onLaunch={onLaunch}
        onBackToChat={onBackToChat}
      />
    )

    const launchBtn = view.getByRole("button", {
      name: /LAUNCH APPLICATION NOW/i,
    })
    expect(launchBtn).toBeTruthy()
    fireEvent.click(launchBtn)

    expect(onLaunch).toHaveBeenCalledTimes(1)
  })

  it("triggers onBackToChat escape hatch without resetting", async () => {
    const onLaunch = mock(() => {})
    const onBackToChat = mock(() => {})

    const view = render(
      <ExecutiveLaunchCard
        source={sampleSource}
        blueprint={sampleBlueprint}
        balanceFormatted="IDR 14.493.579,66"
        onLaunch={onLaunch}
        onBackToChat={onBackToChat}
      />
    )

    const backBtn = view.getByRole("button", {
      name: /Kembali ke Tanya Chat/i,
    })
    expect(backBtn).toBeTruthy()
    fireEvent.click(backBtn)

    expect(onBackToChat).toHaveBeenCalledTimes(1)
  })

  it("handles GitHub repository adapter and different compute tier", () => {
    const ghSource = {
      url: "https://github.com/facebook/react.git",
      branch: "develop",
      rootDir: "./packages/react",
    }
    const ghBlueprint = {
      framework: "Next.js 15.0.0",
      runtime: "Node.js 22",
      port: 3000,
      computeTier: "Starter",
      subdomain: "react-preview",
      envVarsCount: 3,
      hourlyRate: 0.02,
    }

    const view = render(
      <ExecutiveLaunchCard
        source={ghSource}
        blueprint={ghBlueprint}
        balanceFormatted="$100.00"
        onLaunch={() => {}}
        onBackToChat={() => {}}
      />
    )

    expect(
      view.getByText("Verified via GitHub Adapter (github.com/facebook/react)")
    ).toBeTruthy()
    expect(view.getByText("Next.js 15.0.0 (Node.js 22)")).toBeTruthy()
    expect(view.getByText("3000 (HTTP)")).toBeTruthy()
    expect(view.getByText("develop / ./packages/react")).toBeTruthy()
    expect(view.getByText("react-preview")).toBeTruthy()
    expect(
      view.getByText("Starter Tier (0.5 vCPU · 512MB RAM · $0.02/hour)")
    ).toBeTruthy()
  })

  it("displays loading and disabled state when isLaunching is true", () => {
    const view = render(
      <ExecutiveLaunchCard
        source={sampleSource}
        blueprint={sampleBlueprint}
        balanceFormatted="IDR 14.493.579,66"
        isLaunching={true}
        onLaunch={() => {}}
        onBackToChat={() => {}}
      />
    )

    const launchBtn = view.getByRole("button", {
      name: /Launching Application\.\.\./i,
    })
    expect(launchBtn).toBeTruthy()
    expect(launchBtn).toBeDisabled()
  })

  it("handles balance failure gracefully with error badge", async () => {
    mockFetch.mockImplementationOnce(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/api/billing/account")) {
        return new Response(
          JSON.stringify({ ok: false, message: "Service unavailable" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        )
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    })

    const view = render(
      <ExecutiveLaunchCard
        source={sampleSource}
        blueprint={sampleBlueprint}
        onLaunch={() => {}}
        onBackToChat={() => {}}
      />
    )

    await waitFor(() => {
      expect(view.getByText("Could Not Verify Balance")).toBeTruthy()
    })
  })
})
