import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react"
import { DeployChatStream } from "./deploy-chat-stream"

const mockInspectSuccess = {
  ok: true,
  data: {
    status: "detection_success",
    access: { state: "public" },
    detection: {
      framework: "Next.js",
      version: "14.2.3",
      primaryEngine: "Node.js 20",
      port: 3000,
      confidence: 0.95,
      startCommand: "pnpm start",
    },
    plan: {
      resources: { package: "medium" },
      domain: { hostname: "my-app" },
    },
    session: { id: "sess-stream-1" },
  },
}

const mockFetch = mock(
  async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input)

    if (url.includes("/api/integrations/github/repositories")) {
      return new Response(
        JSON.stringify({
          ok: true,
          items: [
            {
              id: "1",
              name: "my-ecommerce-web",
              fullName: "juniyadi/my-ecommerce-web",
              htmlUrl: "https://github.com/juniyadi/my-ecommerce-web",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }

    if (url.includes("/api/deploy/ai-sessions/inspect")) {
      return new Response(JSON.stringify(mockInspectSuccess), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    if (url.includes("/chat")) {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              "Port aplikasi telah berhasil diperbarui ke 8080."
            )
          )
          controller.close()
        },
      })
      return new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }
)

globalThis.fetch = mockFetch as unknown as typeof fetch

describe("DeployChatStream", () => {
  afterEach(cleanup)

  beforeEach(() => {
    mockFetch.mockClear()
  })

  it("renders Tanya P welcome banner and connected repositories", async () => {
    const view = render(
      <DeployChatStream
        initialUserName="Alex"
        lang="en"
        onReadyToLaunch={() => {}}
      />
    )

    expect(
      view.getByText("Hi Alex, what do you want to deploy today?")
    ).toBeTruthy()

    await waitFor(() => {
      expect(view.getByText("my-ecommerce-web")).toBeTruthy()
    })
  })

  it("inspects git repository URL, renders tool telemetry badges and inline blueprint card", async () => {
    const onReadyToLaunch = mock(() => {})
    const view = render(
      <DeployChatStream
        initialUserName="Alex"
        lang="en"
        onReadyToLaunch={onReadyToLaunch}
      />
    )

    const input = view.getByRole("textbox")
    await act(async () => {
      fireEvent.change(input, {
        target: { value: "https://github.com/acme/public-app" },
      })
      fireEvent.keyDown(input, { key: "Enter", shiftKey: false })
    })

    // Verify tool telemetry badges render
    await waitFor(() => {
      expect(view.getByText(/⚙ Tool: list_repo_files/i)).toBeTruthy()
      expect(
        view.getAllByText(/⚙ Tool: read_repo_file/i).length
      ).toBeGreaterThanOrEqual(1)
    })

    // Verify inline blueprint card renders
    expect(view.getByTestId("inline-blueprint-card")).toBeTruthy()
    expect(view.getByText("Next.js 14.2.3 · Node.js 20")).toBeTruthy()
    expect(view.getByText("3000 (HTTP)")).toBeTruthy()

    // Test transition CTA
    const launchBtn = view.getByRole("button", {
      name: /SIAP DEPLOY -> LANJUT KE LAUNCH CARD/i,
    })
    fireEvent.click(launchBtn)

    expect(onReadyToLaunch).toHaveBeenCalledTimes(1)
  })

  it("streams replies from chat API and applies conversational blueprint mutations", async () => {
    const view = render(
      <DeployChatStream
        initialUserName="Alex"
        lang="en"
        initialSessionId="sess-stream-1"
        onReadyToLaunch={() => {}}
      />
    )

    // First inspect to populate blueprint
    const input = view.getByRole("textbox")
    await act(async () => {
      fireEvent.change(input, {
        target: { value: "https://github.com/acme/public-app" },
      })
      fireEvent.keyDown(input, { key: "Enter", shiftKey: false })
    })

    await waitFor(() => {
      expect(view.getByText("3000 (HTTP)")).toBeTruthy()
    })

    // Send conversational mutation command
    await act(async () => {
      fireEvent.change(input, {
        target: { value: "Ganti port ke 8080" },
      })
      fireEvent.keyDown(input, { key: "Enter", shiftKey: false })
    })

    // Verifies stream reply and updated port
    await waitFor(() => {
      expect(
        view.getByText("Port aplikasi telah berhasil diperbarui ke 8080.")
      ).toBeTruthy()
      expect(view.getByText("8080 (HTTP)")).toBeTruthy()
      expect(view.getByText(/⚙ Tool: update_blueprint_field/i)).toBeTruthy()
    })
  })

  it("displays failure explanation when repository inspection is blocked", async () => {
    mockFetch.mockImplementation(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = String(input)
        if (url.includes("/api/deploy/ai-sessions/inspect")) {
          return new Response(
            JSON.stringify({
              ok: true,
              data: {
                status: "blocked",
                decision: {
                  isLaunchable: false,
                  message: "Repository contains blocked legacy dependencies.",
                },
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

    const view = render(
      <DeployChatStream
        initialUserName="Alex"
        lang="en"
        onReadyToLaunch={() => {}}
      />
    )

    const input = view.getByRole("textbox")
    await act(async () => {
      fireEvent.change(input, {
        target: { value: "https://github.com/acme/legacy-app" },
      })
      fireEvent.keyDown(input, { key: "Enter", shiftKey: false })
    })

    await waitFor(() => {
      expect(
        view.getAllByText(/Repository contains blocked legacy dependencies/i)
          .length
      ).toBeGreaterThanOrEqual(1)
      expect(view.getByText(/Inspection Failed/i)).toBeTruthy()
    })
  })

  it("renders AuthRecoveryCard when inspecting private repository requiring access", async () => {
    mockFetch.mockImplementation(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = String(input)
        if (url.includes("/api/deploy/ai-sessions/inspect")) {
          return new Response(
            JSON.stringify({
              ok: false,
              data: {
                status: "access_required",
                reasonCode: "ACCESS_REQUIRED",
                access: { state: "connection_required" },
              },
            }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          )
        }
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
    )

    const view = render(
      <DeployChatStream
        initialUserName="Alex"
        lang="id"
        onReadyToLaunch={() => {}}
      />
    )

    const input = view.getByRole("textbox")
    await act(async () => {
      fireEvent.change(input, {
        target: { value: "https://github.com/my-enterprise/private-core" },
      })
      fireEvent.keyDown(input, { key: "Enter", shiftKey: false })
    })

    await waitFor(() => {
      expect(view.getByTestId("auth-recovery-card")).toBeTruthy()
      expect(
        view.getByText(/AKSES REPOSITORY DIBUTUHKAN \(PRIVATE REPOSITORY\)/i)
      ).toBeTruthy()
    })
  })

  it("renders MonorepoDisambiguationCard and generates blueprint on project selection", async () => {
    mockFetch.mockImplementation(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = String(input)
        if (url.includes("/api/deploy/ai-sessions/inspect")) {
          return new Response(
            JSON.stringify({
              ok: true,
              data: {
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

    const view = render(
      <DeployChatStream
        initialUserName="Alex"
        lang="id"
        onReadyToLaunch={() => {}}
      />
    )

    const input = view.getByRole("textbox")
    await act(async () => {
      fireEvent.change(input, {
        target: { value: "https://github.com/acme-corp/turborepo-monorepo" },
      })
      fireEvent.keyDown(input, { key: "Enter", shiftKey: false })
    })

    await waitFor(() => {
      expect(view.getByTestId("monorepo-disambiguation-card")).toBeTruthy()
    })

    // Click quick-pick chip for apps/web
    const chip = view.getByTestId("monorepo-chip-0")
    await act(async () => {
      fireEvent.click(chip)
    })

    await waitFor(() => {
      expect(view.getByTestId("inline-blueprint-card")).toBeTruthy()
      expect(view.getByText(/Next\.js 15\.4 · Node\.js 20/i)).toBeTruthy()
    })
  })

  it("renders PolicyBlockedCard when repository violates platform security rules", async () => {
    mockFetch.mockImplementation(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = String(input)
        if (url.includes("/api/deploy/ai-sessions/inspect")) {
          return new Response(
            JSON.stringify({
              ok: false,
              data: {
                status: "blocked",
                session: {
                  status: "BLOCKED",
                  blockedReason:
                    "Matched Rule ID: RULE-BLOCK-WP-LEGACY. Ditemukan file wp-config.php dan core lama yang rentan CVE.",
                },
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

    const view = render(
      <DeployChatStream
        initialUserName="Alex"
        lang="id"
        onReadyToLaunch={() => {}}
      />
    )

    const input = view.getByRole("textbox")
    await act(async () => {
      fireEvent.change(input, {
        target: { value: "https://github.com/legacy-org/old-wordpress-app" },
      })
      fireEvent.keyDown(input, { key: "Enter", shiftKey: false })
    })

    await waitFor(() => {
      expect(view.getByTestId("policy-blocked-card")).toBeTruthy()
      expect(
        view.getByText(/DEPLOYMENT DIBLOKIR OLEH KEBIJAKAN PLATFORM/i)
      ).toBeTruthy()
      expect(view.getByTestId("policy-marketplace-btn")).toBeTruthy()
    })
  })

  it("renders LowConfidenceFallbackCard and updates blueprint upon applying overrides", async () => {
    mockFetch.mockImplementation(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = String(input)
        if (url.includes("/api/deploy/ai-sessions/inspect")) {
          return new Response(
            JSON.stringify({
              ok: true,
              data: {
                detection: {
                  confidence: 42,
                  framework: "Custom App",
                },
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

    const view = render(
      <DeployChatStream
        initialUserName="Alex"
        lang="id"
        onReadyToLaunch={() => {}}
      />
    )

    const input = view.getByRole("textbox")
    await act(async () => {
      fireEvent.change(input, {
        target: { value: "https://github.com/my-lab/custom-script" },
      })
      fireEvent.keyDown(input, { key: "Enter", shiftKey: false })
    })

    await waitFor(() => {
      expect(view.getByTestId("low-confidence-fallback-card")).toBeTruthy()
    })

    // Apply custom start command and port
    const portInput = view.getByTestId("fallback-port-input")
    const saveBtn = view.getByTestId("fallback-save-btn")

    await act(async () => {
      fireEvent.change(portInput, { target: { value: "8080" } })
      fireEvent.click(saveBtn)
    })

    await waitFor(() => {
      expect(view.getByTestId("inline-blueprint-card")).toBeTruthy()
      expect(view.getByText("8080 (HTTP)")).toBeTruthy()
    })
  })

  it("handles natural language prompt commands for start command and port", async () => {
    const view = render(
      <DeployChatStream
        initialUserName="Alex"
        lang="id"
        onReadyToLaunch={() => {}}
      />
    )

    const input = view.getByRole("textbox")
    await act(async () => {
      fireEvent.change(input, {
        target: { value: "Jalankan dengan node server.js di port 8080" },
      })
      fireEvent.keyDown(input, { key: "Enter", shiftKey: false })
    })

    await waitFor(() => {
      expect(view.getByTestId("inline-blueprint-card")).toBeTruthy()
      expect(view.getByText("8080 (HTTP)")).toBeTruthy()
    })
  })
})
