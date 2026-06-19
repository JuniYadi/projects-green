import { describe, it, expect } from "bun:test"

import { createVpnServerScanner } from "./vpn-connection-scanner"
import type { TcpDialer, UdpProber } from "./vpn-port-checker"
import type {
  SshExecer,
  VpnServerConnectionTester,
} from "./vpn-server-connection"

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

const sshOk: VpnServerConnectionTester = async (server) => ({
  reachable: true,
  message: "Server reachable via SSH (42ms).",
  checkedAt: "2026-06-13T10:00:00Z",
  latencyMs: 42,
  usedAddress: server.hostname,
})

const sshFail: VpnServerConnectionTester = async () => ({
  reachable: false,
  message: "Connection refused.",
  checkedAt: "2026-06-13T10:00:00Z",
  errorCode: "connection_timeout",
})

const tcpPass: TcpDialer = async () => ({
  ok: true,
  latencyMs: 10,
  message: "TCP connection succeeded — port is open",
})
const udpPass: UdpProber = async () => ({
  ok: true,
  latencyMs: 2300,
  message: "No ICMP error received — port appears open",
})

// SSH exec helpers — `ssExec(stdout)` simulates a successful `ss -ntulp`, while
// `ssExecEmpty` yields no parseable output (forces the external-probe fallback).
const ssExec =
  (stdout: string): SshExecer =>
  async () => ({
    ok: true,
    stdout,
    stderr: "",
  })
const ssExecEmpty: SshExecer = async () => ({
  ok: true,
  stdout: "",
  stderr: "",
})
const resolveKeyOk = async () => "PRIVATE_KEY"

describe("createVpnServerScanner", () => {
  it("reports completed when ssh and all enabled ports pass", async () => {
    const scan = createVpnServerScanner({
      sshTester: sshOk,
      tcpDial: tcpPass,
      udpProbe: udpPass,
      resolveKey: resolveKeyOk,
      sshExec: ssExec(
        'udp UNCONN 0 0 0.0.0.0:1194 0.0.0.0:* users:(("openvpn",pid=1000,fd=8))'
      ),
    })
    const result = await scan(makeServer())
    expect(result.status).toBe("completed")
    expect(result.summary.passed).toBe(2) // ssh + openvpn
    expect(result.results.find((r) => r.check === "openvpn")?.status).toBe(
      "pass"
    )
  })

  it("skips disabled protocols with a clear reason", async () => {
    const scan = createVpnServerScanner({
      sshTester: sshOk,
      tcpDial: tcpPass,
      udpProbe: udpPass,
    })
    const result = await scan(makeServer())
    const wg = result.results.find((r) => r.check === "wireguard")
    expect(wg?.status).toBe("skip")
    expect(wg?.message).toContain("not enabled")
  })

  it("rolls up to partial when an enabled port fails", async () => {
    const udpFail: UdpProber = async () => ({
      ok: false,
      kind: "fail",
      latencyMs: null,
      message: "Port unreachable — ICMP Port Unreachable — port is closed",
    })
    const scan = createVpnServerScanner({
      sshTester: sshOk,
      tcpDial: tcpPass,
      udpProbe: udpFail,
    })
    const result = await scan(makeServer())
    expect(result.status).toBe("partial")
    expect(result.summary.failed).toBe(1)
    expect(result.results.find((r) => r.check === "openvpn")?.detail).toContain(
      "Firewall"
    )
  })

  it("rolls up to failed and skips ports when ssh is down", async () => {
    const scan = createVpnServerScanner({
      sshTester: sshFail,
      tcpDial: tcpPass,
      udpProbe: udpPass,
    })
    const result = await scan(makeServer({ hasProxy: true, proxyPort: 3128 }))
    expect(result.status).toBe("failed")
    const openvpn = result.results.find((r) => r.check === "openvpn")
    expect(openvpn?.status).toBe("skip")
    expect(openvpn?.message).toContain("network level")
  })

  it("errors when an enabled protocol has no port configured", async () => {
    const scan = createVpnServerScanner({
      sshTester: sshOk,
      tcpDial: tcpPass,
      udpProbe: udpPass,
    })
    const result = await scan(
      makeServer({ hasOpenVpn: true, openVpnPort: null })
    )
    const openvpn = result.results.find((r) => r.check === "openvpn")
    expect(openvpn?.status).toBe("error")
    expect(openvpn?.message).toContain("not configured")
    expect(result.status).toBe("partial")
  })

  it("classifies a tcp timeout as an error and stays partial", async () => {
    const tcpTimeout: TcpDialer = async () => ({
      ok: false,
      kind: "error",
      latencyMs: null,
      message: "Connection timed out after 5000ms",
    })
    const scan = createVpnServerScanner({
      sshTester: sshOk,
      tcpDial: tcpTimeout,
      udpProbe: udpPass,
    })
    const result = await scan(
      makeServer({
        hasOpenVpn: false,
        openVpnPort: null,
        hasProxy: true,
        proxyPort: 3128,
      })
    )
    const proxy = result.results.find((r) => r.check === "proxy")
    expect(proxy?.status).toBe("error")
    expect(result.summary.errors).toBe(1)
    expect(result.status).toBe("partial")
  })

  it("falls back to the IP when hostname DNS fails on a tcp port probe", async () => {
    const dnsThenOk: TcpDialer = async (host) => {
      if (host === "vpn-id-01.example.net") {
        return {
          ok: false,
          kind: "error",
          latencyMs: null,
          message: "DNS resolution failed",
        }
      }
      return {
        ok: true,
        latencyMs: 88,
        message: "TCP connection succeeded — port is open",
      }
    }
    const scan = createVpnServerScanner({
      sshTester: sshOk,
      tcpDial: dnsThenOk,
      udpProbe: udpPass,
      resolveKey: resolveKeyOk,
      sshExec: ssExecEmpty,
    })
    const result = await scan(
      makeServer({
        hasOpenVpn: false,
        openVpnPort: null,
        hasProxy: true,
        proxyPort: 3128,
        ipAddress: "64.120.95.199",
      })
    )
    const proxy = result.results.find((r) => r.check === "proxy")
    expect(proxy?.status).toBe("pass")
    expect(proxy?.host).toBe("64.120.95.199")
    expect(proxy?.detail).toContain("IP fallback 64.120.95.199 used")
    expect(result.status).toBe("completed")
  })

  it("does not retry on a terminal ECONNREFUSED error", async () => {
    const calls: string[] = []
    const refused: TcpDialer = async (host) => {
      calls.push(host)
      return {
        ok: false,
        kind: "fail",
        latencyMs: null,
        message: "Connection refused (port closed)",
      }
    }
    const scan = createVpnServerScanner({
      sshTester: sshOk,
      tcpDial: refused,
      udpProbe: udpPass,
      resolveKey: resolveKeyOk,
      sshExec: ssExecEmpty,
    })
    const result = await scan(
      makeServer({
        hasOpenVpn: false,
        openVpnPort: null,
        hasProxy: true,
        proxyPort: 3128,
        ipAddress: "64.120.95.199",
      })
    )
    const proxy = result.results.find((r) => r.check === "proxy")
    expect(proxy?.status).toBe("fail")
    expect(calls).toEqual(["vpn-id-01.example.net"]) // no fallback retry
  })

  it("surfaces a fallback suggestion when DNS fails and no IP is set", async () => {
    const dnsFail: TcpDialer = async () => ({
      ok: false,
      kind: "error",
      latencyMs: null,
      message: "DNS resolution failed",
    })
    const scan = createVpnServerScanner({
      sshTester: sshOk,
      tcpDial: dnsFail,
      udpProbe: udpPass,
      resolveKey: resolveKeyOk,
      sshExec: ssExecEmpty,
    })
    const result = await scan(
      makeServer({
        hasOpenVpn: false,
        openVpnPort: null,
        hasProxy: true,
        proxyPort: 3128,
      })
    )
    const proxy = result.results.find((r) => r.check === "proxy")
    expect(proxy?.status).toBe("error")
    expect(proxy?.detail).toContain("No IP fallback configured")
  })

  it("reports DNS failure on both hostname and IP fallback", async () => {
    const dnsFail: TcpDialer = async () => ({
      ok: false,
      kind: "error",
      latencyMs: null,
      message: "DNS resolution failed",
    })
    const scan = createVpnServerScanner({
      sshTester: sshOk,
      tcpDial: dnsFail,
      udpProbe: udpPass,
      resolveKey: resolveKeyOk,
      sshExec: ssExecEmpty,
    })
    const result = await scan(
      makeServer({
        hasOpenVpn: false,
        openVpnPort: null,
        hasProxy: true,
        proxyPort: 3128,
        ipAddress: "64.120.95.199",
      })
    )
    const proxy = result.results.find((r) => r.check === "proxy")
    expect(proxy?.status).toBe("error")
    expect(proxy?.detail).toContain("also failed DNS resolution")
  })

  it("de-duplicates when hostname equals ipAddress", async () => {
    const calls: string[] = []
    const dnsFail: UdpProber = async (host) => {
      calls.push(host)
      return {
        ok: false,
        kind: "error",
        latencyMs: null,
        message: "Failed to send UDP probe: getaddrinfo ENOTFOUND",
      }
    }
    const scan = createVpnServerScanner({
      sshTester: sshOk,
      tcpDial: tcpPass,
      udpProbe: dnsFail,
    })
    await scan(
      makeServer({ hostname: "64.120.95.199", ipAddress: "64.120.95.199" })
    )
    expect(calls).toEqual(["64.120.95.199"]) // single candidate, not duplicated
  })
})

describe("createVpnServerScanner — SSH-based port verification", () => {
  it("passes with process name + pid when the port is listening", async () => {
    const scan = createVpnServerScanner({
      sshTester: sshOk,
      tcpDial: tcpPass,
      udpProbe: udpPass,
      resolveKey: async () => "PRIVATE_KEY",
      sshExec: ssExec(
        'udp UNCONN 0 0 0.0.0.0:1194 0.0.0.0:* users:(("docker-proxy",pid=12150,fd=8))'
      ),
    })
    const result = await scan(makeServer())
    const openvpn = result.results.find((r) => r.check === "openvpn")
    expect(openvpn?.status).toBe("pass")
    expect(openvpn?.processName).toBe("docker-proxy")
    expect(openvpn?.processPid).toBe(12150)
    expect(openvpn?.message).toContain("docker-proxy")
    expect(result.status).toBe("completed")
  })

  it("fails (no false positive) when SSH ss shows nothing listening", async () => {
    const scan = createVpnServerScanner({
      sshTester: sshOk,
      tcpDial: tcpPass,
      udpProbe: udpPass,
      resolveKey: async () => "PRIVATE_KEY",
      // ss reports sshd only — WireGuard 51820 is NOT in the list.
      sshExec: ssExec(
        'tcp LISTEN 0 128 0.0.0.0:22 0.0.0.0:* users:(("sshd",pid=848,fd=6))'
      ),
    })
    const result = await scan(
      makeServer({ hasWireGuard: true, wireGuardPort: 51820 })
    )
    const wg = result.results.find((r) => r.check === "wireguard")
    expect(wg?.status).toBe("fail")
    expect(wg?.message).toContain("not running")
    expect(result.status).toBe("partial")
  })

  it("flags a misconfiguration: port active but protocol disabled", async () => {
    const scan = createVpnServerScanner({
      sshTester: sshOk,
      tcpDial: tcpPass,
      udpProbe: udpPass,
      resolveKey: async () => "PRIVATE_KEY",
      sshExec: ssExec(
        [
          'udp UNCONN 0 0 0.0.0.0:1194 0.0.0.0:* users:(("docker-proxy",pid=12150,fd=8))',
          'udp UNCONN 0 0 [::]:51820 [::]:* users:(("wireguard",pid=9876,fd=3))',
        ].join("\n")
      ),
    })
    // WireGuard is disabled but listening on 51820.
    const result = await scan(
      makeServer({ hasWireGuard: false, wireGuardPort: 51820 })
    )
    const wg = result.results.find((r) => r.check === "wireguard")
    expect(wg?.status).toBe("skip")
    expect(wg?.suggestedAction).toBe("ENABLE_PROTOCOL")
    expect(wg?.processName).toBe("wireguard")
    expect(wg?.message).toContain("disabled")
  })

  it("falls back to external UDP probe (inconclusive error) when ss exec fails", async () => {
    const scan = createVpnServerScanner({
      sshTester: sshOk,
      tcpDial: tcpPass,
      udpProbe: udpPass,
      resolveKey: async () => "PRIVATE_KEY",
      sshExec: ssExecEmpty, // exec yields no parseable output
    })
    const result = await scan(makeServer())
    const openvpn = result.results.find((r) => r.check === "openvpn")
    expect(openvpn?.status).toBe("error")
    expect(openvpn?.message).toContain("inconclusive")
    expect(openvpn?.detail).toContain("ss -ntulp | grep :1194")
  })

  it("uses reliable external TCP dial on ss exec failure (no false negative)", async () => {
    const scan = createVpnServerScanner({
      sshTester: sshOk,
      tcpDial: tcpPass,
      udpProbe: udpPass,
      resolveKey: async () => "PRIVATE_KEY",
      sshExec: ssExecEmpty,
    })
    const result = await scan(
      makeServer({
        hasOpenVpn: false,
        openVpnPort: null,
        hasProxy: true,
        proxyPort: 3128,
      })
    )
    const proxy = result.results.find((r) => r.check === "proxy")
    expect(proxy?.status).toBe("pass")
  })

  it("skips port checks at network level when SSH is unreachable", async () => {
    const scan = createVpnServerScanner({
      sshTester: sshFail,
      tcpDial: tcpPass,
      udpProbe: udpPass,
      resolveKey: async () => "PRIVATE_KEY",
      sshExec: ssExecEmpty,
    })
    const result = await scan(makeServer({ hasProxy: true, proxyPort: 3128 }))
    expect(result.status).toBe("failed")
    const openvpn = result.results.find((r) => r.check === "openvpn")
    expect(openvpn?.status).toBe("skip")
    expect(openvpn?.message).toContain("network level")
  })
})
