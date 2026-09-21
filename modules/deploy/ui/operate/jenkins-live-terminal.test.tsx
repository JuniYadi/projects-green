import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import {
  JenkinsLiveTerminal,
  parseAnsiLine,
  parseJenkinsStages,
  stripAnsi,
} from "./jenkins-live-terminal"

mock.module("next/navigation", () => ({
  useParams: () => ({ lang: "en" }),
}))

describe("JenkinsLiveTerminal", () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    cleanup()
    globalThis.fetch = originalFetch
  })

  it("groups Jenkins console output into selectable pipeline stages", () => {
    const stages = parseJenkinsStages(
      [
        "[Pipeline] Start of Pipeline",
        "[Pipeline] { (Checkout)",
        "Cloning repository",
        "[Pipeline] { (Build image)",
        "docker build .",
        "[Pipeline] { (Security scan)",
        "ERROR: vulnerabilities found",
      ],
      false
    )

    expect(stages).toEqual([
      { name: "Checkout", startLine: 1, endLine: 3, status: "completed" },
      {
        name: "Build image",
        startLine: 3,
        endLine: 5,
        status: "completed",
      },
      {
        name: "Security scan",
        startLine: 5,
        endLine: 7,
        status: "failed",
      },
    ])
  })

  describe("ANSI parser utilities", () => {
    it("strips ANSI escape codes correctly", () => {
      const raw = "\x1b[32m[INFO]\x1b[0m Build \x1b[1msucceeded\x1b[0m"
      expect(stripAnsi(raw)).toBe("[INFO] Build succeeded")
    })

    it("parses ANSI color codes into styled spans", () => {
      const raw = "\x1b[31m[ERROR]\x1b[0m \x1b[32m[SUCCESS]\x1b[0m"
      const spans = parseAnsiLine(raw)
      expect(spans.length).toBeGreaterThan(1)
      expect(spans[0]?.text).toBe("[ERROR]")
      expect(spans[0]?.className).toContain("text-red-400")
      expect(spans[2]?.text).toBe("[SUCCESS]")
      expect(spans[2]?.className).toContain("text-emerald-400")
    })
  })

  it("renders source tabs and controls", async () => {
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          ok: true,
          text: "[Pipeline] Start of Pipeline\n> git checkout\nDocker build ok",
          isBuilding: true,
        }),
        { headers: { "Content-Type": "application/json" } }
      )
    }) as unknown as typeof globalThis.fetch

    const view = render(
      <JenkinsLiveTerminal
        slug="my-app"
        deployId="deploy-1"
        status="building"
        locale="en"
      />
    )

    expect(view.getByText("Live Jenkins Log")).toBeInTheDocument()
    const terminalViewport = view.getByTestId("terminal-scroll-viewport")
    expect(terminalViewport.className).toContain("h-[420px]")
    expect(terminalViewport.className).toContain("max-h-[420px]")
    expect(terminalViewport.className).toContain("flex-none")
    expect(view.getByText("Release & GitOps Log")).toBeInTheDocument()
    expect(view.getByText("Application Log (Live)")).toBeInTheDocument()

    // Controls
    expect(view.getByText("Autoscroll: ON")).toBeInTheDocument()
    expect(view.getByText("Copy Full Log")).toBeInTheDocument()
    expect(view.getByPlaceholderText("Search logs...")).toBeInTheDocument()

    // Waits for logs to render
    await waitFor(() => {
      expect(view.getByText("[Pipeline] Start of Pipeline")).toBeInTheDocument()
    })
  })

  it("switches tabs and autoscroll toggle", async () => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/logs/")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: [
              { scope: "runtime", message: "Application serving port 3000" },
              { scope: "build", message: "GitOps manifest applied" },
            ],
          }),
          { headers: { "Content-Type": "application/json" } }
        )
      }
      return new Response(
        JSON.stringify({
          ok: true,
          text: "Jenkins log output",
          isBuilding: false,
        }),
        { headers: { "Content-Type": "application/json" } }
      )
    }) as unknown as typeof globalThis.fetch

    const view = render(
      <JenkinsLiveTerminal
        slug="my-app"
        deployId="deploy-1"
        status="building"
        locale="en"
      />
    )

    // Toggle autoscroll
    const autoScrollBtn = view.getByText("Autoscroll: ON")
    fireEvent.click(autoScrollBtn)
    expect(view.getByText("Autoscroll: OFF")).toBeInTheDocument()

    // Switch to GitOps tab
    const gitOpsTab = view.getByText("Release & GitOps Log")
    fireEvent.click(gitOpsTab)

    await waitFor(() => {
      expect(
        view.getByText("[BUILD] GitOps manifest applied")
      ).toBeInTheDocument()
    })
  })

  it("keeps a completed selected stage at the top while logs update", async () => {
    globalThis.fetch = mock(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          text: [
            "[Pipeline] { (Checkout)",
            "Cloning repository",
            "[Pipeline] { (Build image)",
            "docker build .",
          ].join("\n"),
          isBuilding: true,
        }),
        { headers: { "Content-Type": "application/json" } }
      )
    ) as unknown as typeof globalThis.fetch

    const view = render(
      <JenkinsLiveTerminal
        slug="my-app"
        deployId="deploy-1"
        status="building"
        locale="en"
        selectedJenkinsStage="Checkout"
      />
    )
    const terminalViewport = view.getByTestId("terminal-scroll-viewport")

    await waitFor(() => {
      expect(view.getByText("Cloning repository")).toBeInTheDocument()
    })
    Object.defineProperty(terminalViewport, "scrollHeight", {
      configurable: true,
      value: 800,
    })
    terminalViewport.scrollTop = 0

    view.rerender(
      <JenkinsLiveTerminal
        slug="my-app"
        deployId="deploy-1"
        status="building"
        locale="en"
        selectedJenkinsStage="Checkout"
      />
    )

    expect(terminalViewport.scrollTop).toBe(0)
  })

  it("filters lines with search input", async () => {
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          ok: true,
          text: "Step 1: compile\nStep 2: test\nStep 3: package",
          isBuilding: false,
        }),
        { headers: { "Content-Type": "application/json" } }
      )
    }) as unknown as typeof globalThis.fetch

    const view = render(
      <JenkinsLiveTerminal
        slug="my-app"
        deployId="deploy-1"
        status="building"
        locale="en"
      />
    )

    await waitFor(() => {
      expect(view.getByText("Step 1: compile")).toBeInTheDocument()
    })

    const searchInput = view.getByPlaceholderText("Search logs...")
    fireEvent.change(searchInput, { target: { value: "test" } })

    expect(view.queryByText("Step 1: compile")).not.toBeInTheDocument()
    expect(view.getByText("Step 2: test")).toBeInTheDocument()
    expect(view.getByText("1 / 3 lines")).toBeInTheDocument()
  })

  it("renders diagnostic guidance and retry CTA on failure", async () => {
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "JENKINS_AUTH_FAILED",
          message: "Auth failed",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    }) as unknown as typeof globalThis.fetch

    const retryMock = mock(() => {})

    const view = render(
      <JenkinsLiveTerminal
        slug="my-app"
        deployId="deploy-1"
        status="failed"
        failureReason="Runner authentication 401"
        onRetry={retryMock}
        locale="en"
      />
    )

    await waitFor(() => {
      expect(view.getByText("Diagnostic Guidance")).toBeInTheDocument()
    })

    const retryBtn = view.getByRole("button", { name: /retry deploy/i })
    expect(retryBtn).toBeInTheDocument()
    fireEvent.click(retryBtn)
    expect(retryMock).toHaveBeenCalledTimes(1)
  })
})
