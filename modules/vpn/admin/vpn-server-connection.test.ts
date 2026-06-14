import { describe, it, expect, mock } from "bun:test"

import {
  createVpnServerConnectionTester,
  type SshDialer,
} from "./vpn-server-connection"

type AnyFn = (...args: any[]) => any

const makeServer = (over: Record<string, unknown> = {}) =>
  ({
    id: "srv-1",
    name: "ID-01",
    regionId: "reg-1",
    hostname: "vpn-id-01.example.net",
    ipAddress: null,
    sshPort: 22,
    sshKeyId: "key-1",
    sshUser: "root",
    hasOpenVpn: true,
    openVpnPort: 1194,
    hasWireGuard: false,
    wireGuardPort: null,
    hasProxy: false,
    proxyPort: null,
    health: "UNKNOWN",
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    region: {
      id: "reg-1",
      name: "Indonesia",
      slug: "indonesia",
      countryCode: "id",
    },
    sshKey: { id: "key-1", name: "Prod Key", fingerprint: "SHA256:abc" },
    ...over,
  }) as any

const resolveKey = mock<AnyFn>(async () => "PRIVATE_KEY_PEM")

describe("createVpnServerConnectionTester", () => {
  it("reports reachable on a successful handshake", async () => {
    const dial: SshDialer = async () => ({ ok: true, latencyMs: 42 })
    const tester = createVpnServerConnectionTester({ resolveKey, dial })

    const result = await tester(makeServer())
    expect(result.reachable).toBe(true)
    expect(result.latencyMs).toBe(42)
    expect(result.usedAddress).toBe("vpn-id-01.example.net")
  })

  it("dials with the configured ssh port and user", async () => {
    const dial = mock<SshDialer>(async () => ({ ok: true, latencyMs: 5 }))
    const tester = createVpnServerConnectionTester({ resolveKey, dial })

    await tester(makeServer({ sshPort: 2222, sshUser: "deploy" }))
    const target = dial.mock.calls[0][0]
    expect(target.port).toBe(2222)
    expect(target.username).toBe("deploy")
    expect(target.host).toBe("vpn-id-01.example.net")
  })

  it("falls back to ipAddress when hostname DNS fails", async () => {
    const dial = mock<SshDialer>(async ({ host }) => {
      if (host === "vpn-id-01.example.net") {
        return {
          ok: false,
          errorCode: "dns_failure",
          message: "DNS resolution failed for vpn-id-01.example.net.",
        }
      }
      return { ok: true, latencyMs: 88 }
    })
    const tester = createVpnServerConnectionTester({ resolveKey, dial })

    const result = await tester(makeServer({ ipAddress: "203.0.113.10" }))
    expect(result.reachable).toBe(true)
    expect(result.usedAddress).toBe("203.0.113.10")
    expect(dial).toHaveBeenCalledTimes(2)
  })

  it("does not fall back on auth failure", async () => {
    const dial = mock<SshDialer>(async () => ({
      ok: false,
      errorCode: "auth_failure",
      message: "SSH key rejected by server — verify the key is deployed.",
    }))
    const tester = createVpnServerConnectionTester({ resolveKey, dial })

    const result = await tester(makeServer({ ipAddress: "203.0.113.10" }))
    expect(result.reachable).toBe(false)
    expect(result.errorCode).toBe("auth_failure")
    expect(dial).toHaveBeenCalledTimes(1)
  })

  it("surfaces fallbackIp when DNS fails and no IP is set", async () => {
    const dial: SshDialer = async () => ({
      ok: false,
      errorCode: "dns_failure",
      message: "DNS resolution failed.",
    })
    const tester = createVpnServerConnectionTester({ resolveKey, dial })

    const result = await tester(makeServer())
    expect(result.reachable).toBe(false)
    expect(result.errorCode).toBe("dns_failure")
    expect(result.fallbackIp).toBeUndefined()
  })

  it("fails with config_error when no key is found", async () => {
    const dial = mock<SshDialer>(async () => ({ ok: true, latencyMs: 1 }))
    const tester = createVpnServerConnectionTester({
      resolveKey: async () => null,
      dial,
    })

    const result = await tester(makeServer())
    expect(result.reachable).toBe(false)
    expect(result.errorCode).toBe("config_error")
    expect(dial).not.toHaveBeenCalled()
  })

  it("fails with config_error when neither hostname nor ip is set", async () => {
    const dial = mock<SshDialer>(async () => ({ ok: true, latencyMs: 1 }))
    const tester = createVpnServerConnectionTester({ resolveKey, dial })

    const result = await tester(makeServer({ hostname: "  ", ipAddress: null }))
    expect(result.reachable).toBe(false)
    expect(result.errorCode).toBe("config_error")
    expect(dial).not.toHaveBeenCalled()
  })
})
