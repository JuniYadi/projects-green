import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react"
import { GitDeployWizard } from "./git-deploy-wizard"

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
      port: 3000,
      confidence: 0.95,
    },
    session: { id: "sess-wiz-123" },
  },
}

const mockFetch = mock(
  async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input)
    if (url.includes("/api/auth/session")) {
      return new Response(
        JSON.stringify({
          ok: true,
          user: { id: "user-1", firstName: "Developer" },
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
    if (url.includes("/confirm") || url.includes("/api/deploy/submit")) {
      return new Response(
        JSON.stringify({
          ok: true,
          data: { stackId: "stack-xyz", deploymentId: "dep-xyz" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }
    return new Response(JSON.stringify({ ok: true, items: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }
)

globalThis.fetch = mockFetch as unknown as typeof fetch

describe("GitDeployWizard", () => {
  afterEach(cleanup)

  beforeEach(() => {
    mockFetch.mockClear()
  })

  it("renders Fase 1 chat view initially inside DeployMorphContainer", () => {
    const view = render(
      <GitDeployWizard initialUserName="Developer" lang="en" />
    )

    const morphContainer = view.getByTestId("deploy-morph-container")
    expect(morphContainer).toBeTruthy()
    expect(morphContainer.getAttribute("data-screen")).toBe("chat")
    expect(view.getByTestId("deploy-chat-stream")).toBeTruthy()
  })

  it("morphs smoothly from Fase 1 chat into Fase 2 Executive Launch Card and back", async () => {
    const view = render(
      <GitDeployWizard initialUserName="Developer" lang="en" />
    )

    const input = view.getByRole("textbox")

    await act(async () => {
      fireEvent.change(input, {
        target: { value: "https://github.com/acme/my-app" },
      })
      fireEvent.keyDown(input, { key: "Enter", shiftKey: false })
    })

    await waitFor(() => {
      expect(view.getByTestId("inline-blueprint-card")).toBeTruthy()
    })

    // Advance to Fase 2
    const readyBtn = view.getByRole("button", {
      name: /SIAP DEPLOY -> LANJUT KE LAUNCH CARD/i,
    })
    await act(async () => {
      fireEvent.click(readyBtn)
    })

    // Fase 2 Executive Launch Card is displayed
    await waitFor(() => {
      const launchCard = view.getByTestId("executive-launch-card")
      expect(launchCard).toBeTruthy()
      expect(
        within(launchCard).getByText("EXECUTIVE DEPLOYMENT LAUNCH CARD")
      ).toBeTruthy()
      expect(
        within(launchCard).getByText(
          "Verified via GitHub Adapter (github.com/acme/my-app)"
        )
      ).toBeTruthy()
      expect(
        within(launchCard).getByText("Next.js 14.2.3 (Node.js 20)")
      ).toBeTruthy()
      expect(within(launchCard).getByText("3000 (HTTP)")).toBeTruthy()
    })

    // Click escape hatch to go back to chat
    const backBtn = view.getByRole("button", {
      name: /Kembali ke Tanya Chat/i,
    })
    await act(async () => {
      fireEvent.click(backBtn)
    })

    // Back in Fase 1, previous chat conversation remains intact
    await waitFor(() => {
      expect(view.getByTestId("deploy-chat-stream")).toBeTruthy()
      expect(view.getByTestId("inline-blueprint-card")).toBeTruthy()
    })
  })

  it("triggers launch from Executive Launch Card and advances to rollout", async () => {
    const view = render(
      <GitDeployWizard initialUserName="Developer" lang="en" />
    )

    const input = view.getByRole("textbox")
    await act(async () => {
      fireEvent.change(input, {
        target: { value: "https://github.com/acme/my-app" },
      })
      fireEvent.keyDown(input, { key: "Enter", shiftKey: false })
    })

    await waitFor(() => {
      expect(view.getByTestId("inline-blueprint-card")).toBeTruthy()
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

    const launchBtn = view.getByRole("button", {
      name: /LAUNCH APPLICATION NOW/i,
    })
    await act(async () => {
      fireEvent.click(launchBtn)
    })

    // Advances to rollout step
    await waitFor(() => {
      expect(view.getByText("Deployment Rollout")).toBeTruthy()
    })
  })
})
