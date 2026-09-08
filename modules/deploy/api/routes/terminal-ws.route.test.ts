import { describe, it, expect, mock } from "bun:test"
import {
  isAllowedOrigin,
  terminalWsRoute,
  handleWsMessage,
  handleWsClose,
  type WsClientContext,
} from "./terminal-ws.route"

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
