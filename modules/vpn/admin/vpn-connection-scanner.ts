import type { Prisma } from "@prisma/client"

import { decryptSshPrivateKey } from "./vpn-ssh-key.crypto"
import { prisma as defaultPrisma } from "@/lib/prisma"
import type { PrismaClient } from "@prisma/client"
import {
  defaultTcpDial,
  defaultUdpProbe,
  type TcpDialer,
  type UdpProber,
  type CheckTransport,
  type PortCheckOutcome,
} from "./vpn-port-checker"
import {
  createVpnServerConnectionTester,
  type VpnServerConnectionTester,
} from "./vpn-server-connection"

type VpnServerWithRelations = Prisma.VpnServerGetPayload<{
  include: {
    region: { select: { id: true; name: true; slug: true; countryCode: true } }
    sshKey: { select: { id: true; name: true; fingerprint: true } }
  }
}>

export type ScanCheckId = "ssh" | "openvpn" | "wireguard" | "proxy"
export type ScanProtocol = "ssh" | "openvpn" | "wireguard" | "proxy"
export type ScanCheckStatus = "pass" | "fail" | "skip" | "error"
export type ScanStatus = "completed" | "partial" | "failed"

export type ScanCheckResult = {
  check: ScanCheckId
  label: string
  status: ScanCheckStatus
  protocol: ScanProtocol
  host: string | null
  port: number | null
  transport: CheckTransport | null
  latencyMs: number | null
  message: string
  detail?: string
  timestamp: string
}

export type ScanSummary = {
  total: number
  passed: number
  failed: number
  errors: number
  skipped: number
}

export type ScanResult = {
  status: ScanStatus
  startedAt: string
  completedAt: string
  results: ScanCheckResult[]
  summary: ScanSummary
}

export type VpnServerScanner = (
  server: VpnServerWithRelations
) => Promise<ScanResult>

/** Per-check timeouts (ms). SSH gets the longest budget. */
export const SSH_CHECK_TIMEOUT_MS = 10_000
export const PORT_CHECK_TIMEOUT_MS = 5_000

const LABELS: Record<ScanCheckId, string> = {
  ssh: "SSH Connectivity",
  openvpn: "OpenVPN Port",
  wireguard: "WireGuard Port",
  proxy: "Proxy Port",
}

const SUGGESTIONS: Record<Exclude<ScanCheckId, "ssh">, string> = {
  openvpn:
    "Firewall rule likely blocking the OpenVPN port. Check iptables/nftables INPUT chain.",
  wireguard:
    "Send a WireGuard handshake initiation to verify the service responds. Addressed in a future release.",
  proxy:
    "3proxy or SOCKS daemon may not be running. Check systemctl status 3proxy.",
}

type KeyResolver = (sshKeyId: string) => Promise<string | null>

export type VpnServerScannerDeps = {
  /** Reuses the existing SSH handshake tester. */
  sshTester?: VpnServerConnectionTester
  tcpDial?: TcpDialer
  udpProbe?: UdpProber
  resolveKey?: KeyResolver
  now?: () => Date
}

const defaultResolveKey =
  (
    prisma: Pick<PrismaClient, "vpnSshKey"> = defaultPrisma
  ): KeyResolver =>
  async (sshKeyId) => {
    const key = await prisma.vpnSshKey.findUnique({
      where: { id: sshKeyId },
      select: { privateKey: true },
    })
    if (!key) return null
    return decryptSshPrivateKey(key.privateKey)
  }

/**
 * Build an ordered list of host candidates. Hostname is tried first; the IP
 * address is appended as a fallback (de-duplicated when it equals the
 * hostname). Mirrors the SSH tester's hostname→IP fallback behaviour.
 */
function resolveHosts(server: VpnServerWithRelations): string[] {
  const candidates: string[] = []
  const hostname = server.hostname?.trim()
  const ipAddress = server.ipAddress?.trim()
  if (hostname) candidates.push(hostname)
  if (ipAddress && ipAddress !== hostname) candidates.push(ipAddress)
  return candidates
}

/** A DNS resolution failure is retryable with the next host candidate. */
function isDnsError(outcome: PortCheckOutcome): boolean {
  if (outcome.ok) return false
  return (
    outcome.message.includes("DNS resolution") ||
    outcome.message.includes("ENOTFOUND") ||
    outcome.message.includes("EAI_AGAIN")
  )
}

/**
 * Build a multi-check scanner. Runs the SSH handshake plus a port probe for
 * every enabled protocol in parallel, then rolls the per-check results up
 * into an overall status.
 */
export function createVpnServerScanner(
  deps: VpnServerScannerDeps = {}
): VpnServerScanner {
  const tcpDial = deps.tcpDial ?? defaultTcpDial
  const udpProbe = deps.udpProbe ?? defaultUdpProbe
  const resolveKey = deps.resolveKey ?? defaultResolveKey()
  const sshTester =
    deps.sshTester ?? createVpnServerConnectionTester({ resolveKey })
  const now = deps.now ?? (() => new Date())

  return async (server) => {
    const startedAt = now().toISOString()
    const hosts = resolveHosts(server)

    const sshCheck = await runSshCheck(server, sshTester, now)
    const results: ScanCheckResult[] = [sshCheck]

    // If SSH itself is unreachable, the box is dead at the network level.
    // Skip every port probe with a clear reason rather than waiting on timeouts.
    const networkDown = sshCheck.status !== "pass"

    const portChecks = await Promise.all(
      buildPortChecks(server).map((spec) =>
        runPortCheck(spec, hosts, networkDown, { tcpDial, udpProbe, now })
      )
    )
    results.push(...portChecks)

    const summary = summarize(results)
    return {
      status: rollup(sshCheck, summary),
      startedAt,
      completedAt: now().toISOString(),
      results,
      summary,
    }
  }
}

async function runSshCheck(
  server: VpnServerWithRelations,
  sshTester: VpnServerConnectionTester,
  now: () => Date
): Promise<ScanCheckResult> {
  const result = await sshTester(server)
  const host = result.usedAddress ?? resolveHosts(server)[0] ?? null
  return {
    check: "ssh",
    label: LABELS.ssh,
    status: result.reachable ? "pass" : "fail",
    protocol: "ssh",
    host,
    port: server.sshPort,
    transport: "tcp",
    latencyMs: result.latencyMs ?? null,
    message: result.message,
    detail: result.reachable
      ? "SSH handshake completed and the key was accepted."
      : undefined,
    timestamp: now().toISOString(),
  }
}

type PortCheckSpec = {
  check: Exclude<ScanCheckId, "ssh">
  protocol: Exclude<ScanProtocol, "ssh">
  transport: CheckTransport
  enabled: boolean
  port: number | null
}

function buildPortChecks(server: VpnServerWithRelations): PortCheckSpec[] {
  return [
    {
      check: "openvpn",
      protocol: "openvpn",
      transport: "udp",
      enabled: server.hasOpenVpn,
      port: server.openVpnPort,
    },
    {
      check: "wireguard",
      protocol: "wireguard",
      transport: "udp",
      enabled: server.hasWireGuard,
      port: server.wireGuardPort,
    },
    {
      check: "proxy",
      protocol: "proxy",
      transport: "tcp",
      enabled: server.hasProxy,
      port: server.proxyPort,
    },
  ]
}

async function runPortCheck(
  spec: PortCheckSpec,
  hosts: string[],
  networkDown: boolean,
  deps: { tcpDial: TcpDialer; udpProbe: UdpProber; now: () => Date }
): Promise<ScanCheckResult> {
  const base = {
    check: spec.check,
    label: LABELS[spec.check],
    protocol: spec.protocol,
    host: hosts[0] ?? null,
    port: spec.port,
    transport: spec.transport,
  }

  if (!spec.enabled) {
    return {
      ...base,
      status: "skip",
      latencyMs: null,
      message: "Protocol not enabled on this server",
      timestamp: deps.now().toISOString(),
    }
  }

  if (networkDown || hosts.length === 0) {
    return {
      ...base,
      status: "skip",
      latencyMs: null,
      message: "Server unreachable at network level",
      timestamp: deps.now().toISOString(),
    }
  }

  if (spec.port === null) {
    return {
      ...base,
      status: "error",
      latencyMs: null,
      message: "Port not configured",
      timestamp: deps.now().toISOString(),
    }
  }

  const probe = spec.transport === "tcp" ? deps.tcpDial : deps.udpProbe

  let lastError: PortCheckOutcome | null = null

  for (const host of hosts) {
    const outcome = await probe(host, spec.port, PORT_CHECK_TIMEOUT_MS)

    if (outcome.ok) {
      const usedFallback = hosts.length > 1 && host !== hosts[0]
      return {
        ...base,
        host,
        status: "pass",
        latencyMs: outcome.latencyMs,
        message: outcome.message,
        detail: usedFallback
          ? `IP fallback ${host} used after hostname DNS resolution failed.`
          : outcome.detail,
        timestamp: deps.now().toISOString(),
      }
    }

    // Only DNS failures are retryable with the next candidate. Refused,
    // timeout, and host-unreachable are terminal regardless of the address.
    if (!isDnsError(outcome)) {
      return {
        ...base,
        host,
        status: outcome.kind === "fail" ? "fail" : "error",
        latencyMs: outcome.latencyMs,
        message: outcome.message,
        detail: outcome.detail ?? SUGGESTIONS[spec.check],
        timestamp: deps.now().toISOString(),
      }
    }

    lastError = outcome
  }

  // Every candidate failed DNS resolution.
  return {
    ...base,
    host: hosts[0] ?? null,
    status: "error",
    latencyMs: null,
    message:
      lastError?.message ?? "DNS resolution failed for all configured hosts",
    detail:
      hosts.length > 1
        ? `Hostname "${hosts[0]}" could not be resolved. IP fallback "${hosts[1]}" also failed DNS resolution.`
        : `Hostname "${hosts[0]}" could not be resolved. No IP fallback configured — add an IP Address to this server.`,
    timestamp: deps.now().toISOString(),
  }
}

function summarize(results: ScanCheckResult[]): ScanSummary {
  return results.reduce<ScanSummary>(
    (acc, r) => {
      acc.total += 1
      if (r.status === "pass") acc.passed += 1
      else if (r.status === "fail") acc.failed += 1
      else if (r.status === "error") acc.errors += 1
      else if (r.status === "skip") acc.skipped += 1
      return acc
    },
    { total: 0, passed: 0, failed: 0, errors: 0, skipped: 0 }
  )
}

function rollup(ssh: ScanCheckResult, summary: ScanSummary): ScanStatus {
  if (ssh.status !== "pass") return "failed"
  if (summary.failed > 0 || summary.errors > 0) return "partial"
  return "completed"
}

export const scanVpnServerConnection: VpnServerScanner =
  createVpnServerScanner()
