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
})
