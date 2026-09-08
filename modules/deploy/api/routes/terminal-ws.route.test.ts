import { describe, it, expect, mock, beforeEach } from "bun:test"
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
const mockResolveStackExecCredentials = mock()

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

mock.module("@/modules/deploy/pod-exec.service", () => ({
  resolveStackExecCredentials: mockResolveStackExecCredentials,
  buildKubeExecUrl: () => "wss://k8s.test/exec",
  decodeKubeFrame: (buf: ArrayBuffer) => ({ channel: 1, data: "output" }),
  encodeKubeFrame: (channel: number, data: string) => new Uint8Array([channel]),
  encodeResizeFrame: () => new Uint8Array([4]),
  KUBE_EXEC_CHANNELS: { STDIN: 0, STDOUT: 1, STDERR: 2, ERROR: 3, RESIZE: 4 },
}))

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
  beforeEach(() => {
    mockFindUnique.mockReset()
    mockResolveAuthContext.mockReset()
    mockResolveStackExecCredentials.mockReset()
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
  })
})
