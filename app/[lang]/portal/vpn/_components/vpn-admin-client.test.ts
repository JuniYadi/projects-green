import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockWireguardSessionsGet = mock()
const mockServerWireguardSessionsGet = mock()

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      admin: {
        vpn: {
          "wireguard-sessions": {
            get: mockWireguardSessionsGet,
          },
          servers: new Proxy(
            {},
            {
              get: (_target, serverId: string) => ({
                "wireguard-sessions": {
                  get: () => mockServerWireguardSessionsGet(serverId),
                },
              }),
            }
          ),
        },
      },
    },
  },
}))

const { listWireGuardSessions, listWireGuardSessionsByServer } =
  await import("./vpn-admin-client")
type WireGuardSessionItem = import("./vpn-admin-client").WireGuardSessionItem

describe("vpn-admin-client wireguard sessions", () => {
  beforeEach(() => {
    mockWireguardSessionsGet.mockClear()
    mockServerWireguardSessionsGet.mockClear()
  })

  it("listWireGuardSessions returns session list when successful", async () => {
    const mockSessions: WireGuardSessionItem[] = [
      {
        serverId: "srv-1",
        serverName: "Server 1",
        protocol: "WIREGUARD",
        username: "user-1",
        ip: "10.0.0.2",
        status: "Online",
        handshake: "1m ago",
        rx: "1 MB",
        tx: "2 MB",
      },
    ]

    mockWireguardSessionsGet.mockResolvedValueOnce({
      data: {
        ok: true,
        data: mockSessions,
      },
      error: null,
    })

    const result = await listWireGuardSessions()
    expect(result).toEqual({ data: mockSessions })
  })

  it("listWireGuardSessions throws when API returns error", async () => {
    mockWireguardSessionsGet.mockResolvedValueOnce({
      data: {
        ok: false,
        message: "Unauthorized",
      },
      error: null,
    })

    await expect(listWireGuardSessions()).rejects.toThrow("Unauthorized")
  })

  it("listWireGuardSessionsByServer returns sessions for specific server", async () => {
    const mockSessions: WireGuardSessionItem[] = [
      {
        serverId: "srv-2",
        serverName: "Server 2",
        protocol: "WIREGUARD",
        username: "user-2",
        ip: "10.0.0.3",
        status: "Online",
        handshake: "just now",
        rx: "500 KB",
        tx: "1 MB",
      },
    ]

    mockServerWireguardSessionsGet.mockResolvedValueOnce({
      data: {
        ok: true,
        data: mockSessions,
      },
      error: null,
    })

    const result = await listWireGuardSessionsByServer("srv-2")
    expect(result).toEqual({ data: mockSessions })
    expect(mockServerWireguardSessionsGet).toHaveBeenCalledWith("srv-2")
  })

  it("listWireGuardSessionsByServer throws when API returns error", async () => {
    mockServerWireguardSessionsGet.mockResolvedValueOnce({
      data: null,
      error: "SSH_COMMAND_FAILED",
    })

    await expect(listWireGuardSessionsByServer("srv-2")).rejects.toThrow(
      "SSH_COMMAND_FAILED"
    )
  })
})
