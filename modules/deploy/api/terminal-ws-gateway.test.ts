import { describe, expect, it } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { terminalWsGateway } from "./terminal-ws-gateway"

describe("terminal WebSocket gateway", () => {
  it("owns health and WebSocket paths without the HTTP API", async () => {
    await GlobalRegistrator.unregister()
    let server: typeof terminalWsGateway.server = null
    let socket: WebSocket | undefined

    try {
      terminalWsGateway.listen({
        hostname: "127.0.0.1",
        port: 0,
      })
      server = terminalWsGateway.server
      if (!server) throw new Error("WebSocket gateway failed to start")
      const baseUrl = `http://127.0.0.1:${server.port}`
      const healthResponse = await fetch(`${baseUrl}/health`)
      expect(healthResponse.status).toBe(200)
      expect(await healthResponse.json()).toEqual({ ok: true })

      const apiHealthResponse = await fetch(`${baseUrl}/api/health`)
      expect(apiHealthResponse.status).toBe(404)

      const observation = await new Promise<{
        opened: boolean
        payload: unknown
        closeCode: number
        closeReason: string
      }>((resolve, reject) => {
        let opened = false
        let payload: unknown
        let closeEvent: { code: number; reason: string } | undefined
        let settled = false
        // Network lifecycle events cannot be driven by fake timers.
        const timeout = setTimeout(() => {
          settled = true
          reject(new Error("Timed out waiting for terminal WebSocket close"))
        }, 5000)

        const finish = () => {
          if (settled || !opened || payload === undefined || !closeEvent) return
          settled = true
          clearTimeout(timeout)
          resolve({
            opened,
            payload,
            closeCode: closeEvent.code,
            closeReason: closeEvent.reason,
          })
        }

        const NativeWebSocket = WebSocket as unknown as new (
          url: string,
          options: { headers: { Origin: string } }
        ) => WebSocket
        socket = new NativeWebSocket(
          `${baseUrl.replace("http://", "ws://")}/ws/deploy/stacks/stack_test/terminal`,
          { headers: { Origin: "https://invalid.example" } }
        )
        socket.onopen = () => {
          opened = true
          finish()
        }
        socket.onmessage = (event) => {
          if (payload === undefined) payload = JSON.parse(String(event.data))
          finish()
        }
        socket.onclose = (event) => {
          closeEvent = { code: event.code, reason: event.reason }
          finish()
        }
        socket.onerror = () => {
          if (settled) return
          settled = true
          clearTimeout(timeout)
          reject(new Error("Terminal WebSocket emitted an error"))
        }
      })

      expect(observation.opened).toBe(true)
      expect(observation.payload).toEqual({
        type: "error",
        error: "Forbidden: Invalid origin",
      })
      expect(observation.closeCode).toBe(1008)
      expect(observation.closeReason).toBe("Invalid origin")
    } finally {
      if (
        socket &&
        (socket.readyState === WebSocket.CONNECTING ||
          socket.readyState === WebSocket.OPEN)
      ) {
        socket.close()
      }
      if (server) server.stop(true)
      GlobalRegistrator.register()
    }
  }, 10000)
})
