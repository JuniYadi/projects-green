import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test"
import {
  isAllowedOrigin,
  terminalWsRoute,
  handleWsMessage,
  handleWsClose,
  executeTerminalSession,
  type WsClientContext,
  type TerminalWsClient,
} from "./terminal-ws.route"

const mockFindUnique = mock()
const mockResolveAuthContext = mock()
const mockResolveClusterIntegration = mock()
const mockFetch = mock()
// Ordered log of client sends and kube dials, to assert what happens first.
const events: string[] = []

mock.module("@/lib/prisma", () => ({
  prisma: {
    applicationStack: {
      findUnique: mockFindUnique,
    },
  },
}))

mock.module("@/lib/auth/resolve-proxy-auth", () => ({
  resolveAuthContext: mockResolveAuthContext,
}))

mock.module("@/modules/deploy/cluster-integration.service", () => ({
  resolveClusterIntegration: mockResolveClusterIntegration,
  resolveClusterIntegrationByClusterCode: mock(),
}))

const kubeCreds = {
  connectionMode: "EXTERNAL",
  apiServerUrl: "https://k8s.test",
  serviceAccountToken: "tok_123",
  caCertificate: "cert_data",
}

const runningPod = (name: string, creationTimestamp: string) => ({
  metadata: { name, creationTimestamp },
  spec: { containers: [{ name: "app" }] },
  status: {
    phase: "Running",
    conditions: [{ type: "Ready", status: "True" }],
  },
})

const podList = (...items: ReturnType<typeof runningPod>[]) =>
  Response.json({ items })
class MockWebSocket {
  url: string
  protocols?: string[]
  options?: unknown
  binaryType = "blob"
  readyState = 0
  onopen: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onclose: ((event: { code: number }) => void) | null = null
  onerror: (() => void) | null = null
  close = mock()
  send = mock()
  on = mock()
  addEventListener = mock()
  removeEventListener = mock()

  constructor(url: string, protocols?: string[], options?: unknown) {
    events.push("dial")
    this.url = url
    this.protocols = protocols
    this.options = options
  }
}

describe("terminal-ws.route isAllowedOrigin", () => {
  it("rejects null or empty origin", () => {
    expect(isAllowedOrigin(null)).toBe(false)
    expect(isAllowedOrigin("")).toBe(false)
  })

  it("allows standard production domains", () => {
    expect(isAllowedOrigin("https://pfnapp.my.id")).toBe(true)
    expect(isAllowedOrigin("https://pfnapp.id")).toBe(true)
  })

  it("allows configured APP_URL or NEXT_PUBLIC_APP_URL", () => {
    const originalAppUrl = process.env.APP_URL
    process.env.APP_URL = "https://custom.app.internal"
    expect(isAllowedOrigin("https://custom.app.internal")).toBe(true)
    process.env.APP_URL = originalAppUrl
  })

  it("rejects untrusted third-party origins (CSWSH prevention)", () => {
    expect(isAllowedOrigin("https://malicious-site.com")).toBe(false)
    expect(isAllowedOrigin("https://evil.pfnapp.my.id.attacker.com")).toBe(
      false
    )
  })
})

describe("terminalWsRoute definition and message handlers", () => {
  it("defines websocket route on /stacks/:stackId/terminal", () => {
    expect(terminalWsRoute).toBeDefined()
  })

  it("forwards stdin message to kubeWs", () => {
    const mockSend = mock()
    const mockKubeWs = {
      readyState: 1, // OPEN
      send: mockSend,
      close: mock(),
    } as unknown as WebSocket

    const ctx: WsClientContext = {
      kubeWs: mockKubeWs,
    }

    handleWsMessage(ctx, JSON.stringify({ type: "stdin", data: "ls -la\n" }))
    expect(mockSend).toHaveBeenCalled()
    const frame = mockSend.mock.calls[0]?.[0] as Uint8Array
    expect(frame[0]).toBe(0) // STDIN channel
  })

  it("forwards resize message to kubeWs", () => {
    const mockSend = mock()
    const mockKubeWs = {
      readyState: 1, // OPEN
      send: mockSend,
      close: mock(),
    } as unknown as WebSocket

    const ctx: WsClientContext = {
      kubeWs: mockKubeWs,
    }

    handleWsMessage(
      ctx,
      JSON.stringify({ type: "resize", cols: 100, rows: 40 })
    )
    expect(mockSend).toHaveBeenCalled()
    const frame = mockSend.mock.calls[0]?.[0] as Uint8Array
    expect(frame[0]).toBe(4) // RESIZE channel
  })

  it("handles raw string message as stdin fallback", () => {
    const mockSend = mock()
    const mockKubeWs = {
      readyState: 1, // OPEN
      send: mockSend,
      close: mock(),
    } as unknown as WebSocket

    const ctx: WsClientContext = {
      kubeWs: mockKubeWs,
    }

    handleWsMessage(ctx, "echo hi")
    expect(mockSend).toHaveBeenCalled()
    const frame = mockSend.mock.calls[0]?.[0] as Uint8Array
    expect(frame[0]).toBe(0)
  })

  it("ignores message when kubeWs is not open", () => {
    const mockSend = mock()
    const mockKubeWs = {
      readyState: 0, // CONNECTING
      send: mockSend,
      close: mock(),
    } as unknown as WebSocket

    const ctx: WsClientContext = {
      kubeWs: mockKubeWs,
    }

    handleWsMessage(ctx, JSON.stringify({ type: "stdin", data: "ignored" }))
    expect(mockSend).not.toHaveBeenCalled()
  })

  it("marks terminalState clientClosed and closes kubeWs on handleWsClose", () => {
    const mockClose = mock()
    const mockKubeWs = {
      readyState: 1, // OPEN
      send: mock(),
      close: mockClose,
    } as unknown as WebSocket

    const terminalState = { clientClosed: false }
    const ctx: WsClientContext = {
      terminalState,
      kubeWs: mockKubeWs,
    }

    handleWsClose(ctx)
    expect(terminalState.clientClosed).toBe(true)
    expect(mockClose).toHaveBeenCalledWith(1000, "Client closed terminal")
  })
})

describe("executeTerminalSession validation flows", () => {
  const originalWebSocket = globalThis.WebSocket
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket
    globalThis.fetch = mockFetch as unknown as typeof fetch
    events.length = 0
    mockFindUnique.mockReset()
    mockResolveAuthContext.mockReset()
    mockResolveClusterIntegration.mockReset()
    mockResolveClusterIntegration.mockResolvedValue(kubeCreds)
    mockFetch.mockReset()
    mockFetch.mockImplementation(async () =>
      podList(runningPod("target-stack-abc", "2026-09-13T10:00:00Z"))
    )
  })

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket
    globalThis.fetch = originalFetch
  })

  // A client whose sends are logged as "send:<type>" into `events`.
  const memberClient = (query: TerminalWsClient["data"]["query"] = {}) => {
    const ws: TerminalWsClient = {
      data: {
        params: { stackId: "stk_ok" },
        query,
        headers: { origin: "https://pfnapp.my.id" },
        request: new Request("http://localhost"),
      },
      send: mock((msg: string) => {
        events.push(`send:${(JSON.parse(msg) as { type: string }).type}`)
      }),
      close: mock(),
    }
    return ws
  }

  const asMemberOf = (organizationId: string) => {
    mockResolveAuthContext.mockResolvedValueOnce({
      type: "workos",
      platformRole: "none",
      organizationId,
    })
    mockFindUnique.mockResolvedValueOnce({
      id: "stk_ok",
      organizationId: "org_1",
      slug: "target-stack",
    })
  }

  it("lets a plain org member open the first replica when no pod is given", async () => {
    asMemberOf("org_1")
    mockFetch.mockImplementation(async () =>
      podList(
        runningPod("target-stack-new", "2026-09-13T11:00:00Z"),
        runningPod("target-stack-old", "2026-09-13T10:00:00Z")
      )
    )
    const ws = memberClient()

    await executeTerminalSession(ws, { clientClosed: false })

    expect(ws.close).not.toHaveBeenCalled()
    expect((ws.kubeWs as unknown as MockWebSocket).url).toContain(
      "/namespaces/app-1/pods/target-stack-old/exec"
    )
    expect(events).toEqual(["send:targets", "dial"])
    expect(ws.send).toHaveBeenCalledWith(
      expect.stringContaining(
        '"selected":{"pod":"target-stack-old","container":"app"}'
      )
    )
  })

  it("rejects a pod outside the app with 1008 and never dials", async () => {
    asMemberOf("org_1")
    const ws = memberClient({ pod: "billing-api-xyz" })

    await executeTerminalSession(ws, { clientClosed: false })

    expect(ws.close).toHaveBeenCalledWith(1008, "Invalid terminal target")
    expect(ws.kubeWs).toBeUndefined()
    expect(events).not.toContain("dial")
  })

  it("reports NO_RUNNING_POD with 1008 when the app has no live pod", async () => {
    asMemberOf("org_1")
    mockFetch.mockImplementation(async () => podList())
    const ws = memberClient()

    await executeTerminalSession(ws, { clientClosed: false })

    expect(ws.send).toHaveBeenCalledWith(
      expect.stringContaining('"code":"NO_RUNNING_POD"')
    )
    expect(ws.close).toHaveBeenCalledWith(1008, "No running pod")
    expect(ws.kubeWs).toBeUndefined()
  })

  it("rejects invalid origin with 1008 close code", async () => {
    const mockSend = mock()
    const mockClose = mock()
    const ws: TerminalWsClient = {
      data: {
        params: { stackId: "stk_1" },
        query: { pod: "pod_1" },
        headers: { origin: "https://evil.com" },
      },
      send: mockSend,
      close: mockClose,
    }

    await executeTerminalSession(ws, { clientClosed: false })
    expect(mockClose).toHaveBeenCalledWith(1008, "Invalid origin")
  })

  it("rejects unauthenticated request with 1008 close code", async () => {
    mockResolveAuthContext.mockResolvedValueOnce(null)
    const mockSend = mock()
    const mockClose = mock()
    const ws: TerminalWsClient = {
      data: {
        params: { stackId: "stk_1" },
        query: { pod: "pod_1" },
        headers: { origin: "https://pfnapp.my.id" },
        request: new Request("http://localhost"),
      },
      send: mockSend,
      close: mockClose,
    }

    await executeTerminalSession(ws, { clientClosed: false })
    expect(mockClose).toHaveBeenCalledWith(1008, "Unauthorized")
  })

  it("rejects non-existent stack with 1008 close code", async () => {
    mockResolveAuthContext.mockResolvedValueOnce({
      type: "workos",
      platformRole: "member",
      organizationId: "org_1",
    })
    mockFindUnique.mockResolvedValueOnce(null)

    const mockSend = mock()
    const mockClose = mock()
    const ws: TerminalWsClient = {
      data: {
        params: { stackId: "stk_nonexistent" },
        query: { pod: "pod_1" },
        headers: { origin: "https://pfnapp.my.id" },
        request: new Request("http://localhost"),
      },
      send: mockSend,
      close: mockClose,
    }

    await executeTerminalSession(ws, { clientClosed: false })
    expect(mockClose).toHaveBeenCalledWith(1008, "Stack not found")
  })

  it("rejects stack belonging to another organization for non-super-admin", async () => {
    mockResolveAuthContext.mockResolvedValueOnce({
      type: "workos",
      platformRole: "member",
      organizationId: "org_user",
    })
    mockFindUnique.mockResolvedValueOnce({
      id: "stk_other",
      organizationId: "org_other",
      slug: "other-stack",
    })

    const mockSend = mock()
    const mockClose = mock()
    const ws: TerminalWsClient = {
      data: {
        params: { stackId: "stk_other" },
        query: { pod: "pod_1" },
        headers: { origin: "https://pfnapp.my.id" },
        request: new Request("http://localhost"),
      },
      send: mockSend,
      close: mockClose,
    }

    await executeTerminalSession(ws, { clientClosed: false })
    expect(mockClose).toHaveBeenCalledWith(1008, "Forbidden")
    expect(ws.kubeWs).toBeUndefined()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("connects to Kubernetes and sets up event handlers for authorized session", async () => {
    mockResolveAuthContext.mockResolvedValueOnce({
      type: "workos",
      platformRole: "super_admin",
      organizationId: "org_admin",
    })
    mockFindUnique.mockResolvedValueOnce({
      id: "stk_ok",
      organizationId: "org_target",
      slug: "target-stack",
    })

    const mockSend = mock()
    const mockClose = mock()
    const ws: TerminalWsClient = {
      data: {
        params: { stackId: "stk_ok" },
        query: {},
        headers: { origin: "https://pfnapp.my.id" },
        request: new Request("http://localhost"),
      },
      send: mockSend,
      close: mockClose,
    }

    const state = { clientClosed: false }
    await executeTerminalSession(ws, state)

    // Verify kubeWs was created and attached
    expect(ws.kubeWs).toBeDefined()
    type MockKubeWs = {
      onopen?: () => void
      onmessage?: (event: { data: unknown }) => void
      onclose?: (event: { code: number }) => void
      onerror?: () => void
    }
    const kubeWs = ws.kubeWs as unknown as MockKubeWs

    // Trigger onopen
    if (kubeWs.onopen) kubeWs.onopen()
    expect(mockSend).toHaveBeenCalledWith(
      JSON.stringify({ type: "status", status: "connected" })
    )

    // Trigger onmessage with stdout
    if (kubeWs.onmessage) {
      kubeWs.onmessage({ data: new Uint8Array([1, 104, 105]).buffer }) // channel 1: stdout
      expect(mockSend).toHaveBeenCalledWith(
        JSON.stringify({ type: "stdout", data: "hi" })
      )

      kubeWs.onmessage({ data: new Uint8Array([3, 101, 114]).buffer }) // channel 3: error
      expect(mockSend).toHaveBeenCalledWith(
        JSON.stringify({ type: "error", data: "er" })
      )
    }

    // Trigger onerror
    if (kubeWs.onerror) {
      kubeWs.onerror()
      expect(mockSend).toHaveBeenCalledWith(
        JSON.stringify({
          type: "error",
          error: "Kubernetes exec connection failed",
        })
      )
    }

    // Trigger onclose
    if (kubeWs.onclose) {
      kubeWs.onclose({ code: 1000 })
      expect(mockSend).toHaveBeenCalledWith(
        JSON.stringify({ type: "status", status: "disconnected", code: 1000 })
      )
    }
  })

  it("handles exception thrown during credential resolution gracefully", async () => {
    mockResolveAuthContext.mockResolvedValueOnce({
      type: "workos",
      platformRole: "super_admin",
      organizationId: "org_admin",
    })
    mockFindUnique.mockResolvedValueOnce({
      id: "stk_err",
      organizationId: "org_target",
      slug: "err-stack",
    })
    mockResolveClusterIntegration.mockRejectedValueOnce(
      new Error("K8s cluster integration failed")
    )

    const mockSend = mock()
    const mockClose = mock()
    const ws: TerminalWsClient = {
      data: {
        params: { stackId: "stk_err" },
        query: { pod: "pod_test" },
        headers: { origin: "https://pfnapp.my.id" },
        request: new Request("http://localhost"),
      },
      send: mockSend,
      close: mockClose,
    }

    await executeTerminalSession(ws, { clientClosed: false })
    expect(mockSend).toHaveBeenCalledWith(
      JSON.stringify({ type: "error", error: "K8s cluster integration failed" })
    )
    expect(mockClose).toHaveBeenCalledWith(
      1011,
      "K8s cluster integration failed"
    )
  })
})
