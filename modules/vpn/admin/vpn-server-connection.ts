import { Client } from "ssh2"
import type { Prisma, PrismaClient } from "@prisma/client"

import { prisma as defaultPrisma } from "@/lib/prisma"

import { decryptSshPrivateKey } from "./vpn-ssh-key.crypto"

type VpnServerWithRelations = Prisma.VpnServerGetPayload<{
  include: {
    region: { select: { id: true; name: true; slug: true; countryCode: true } }
    sshKey: { select: { id: true; name: true; fingerprint: true } }
  }
}>

export type VpnServerConnectionErrorCode =
  | "connection_timeout"
  | "dns_failure"
  | "auth_failure"
  | "protocol_error"
  | "config_error"

export type VpnServerConnectionResult = {
  reachable: boolean
  message: string
  checkedAt: string
  latencyMs?: number
  errorCode?: VpnServerConnectionErrorCode
  /** Address actually used for the successful/attempted handshake. */
  usedAddress?: string
  /** IP fallback that is available (or was attempted) when hostname fails. */
  fallbackIp?: string
}

export type VpnServerConnectionTester = (
  server: VpnServerWithRelations
) => Promise<VpnServerConnectionResult>

/** Max time to wait for the SSH handshake before failing fast. */
export const SSH_HANDSHAKE_TIMEOUT_MS = 10_000

type DialTarget = {
  host: string
  port: number
  username: string
  privateKey: string
}

type DialOutcome =
  | { ok: true; latencyMs: number }
  | {
      ok: false
      errorCode: VpnServerConnectionErrorCode
      message: string
    }

export type SshDialer = (target: DialTarget) => Promise<DialOutcome>

/**
 * Perform a handshake-only SSH connection: open the transport, complete key
 * exchange + authentication, then immediately close. No command is sent.
 */
const defaultDial: SshDialer = (target) =>
  new Promise<DialOutcome>((resolve) => {
    const client = new Client()
    const startedAt = Date.now()
    let settled = false

    const finish = (outcome: DialOutcome) => {
      if (settled) return
      settled = true
      try {
        client.end()
      } catch {
        // ignore teardown errors
      }
      resolve(outcome)
    }

    client.on("ready", () => {
      finish({ ok: true, latencyMs: Date.now() - startedAt })
    })

    client.on("error", (err: NodeJS.ErrnoException & { level?: string }) => {
      finish({
        ok: false,
        ...classifyDialError(err, target),
      })
    })

    try {
      client.connect({
        host: target.host,
        port: target.port,
        username: target.username,
        privateKey: target.privateKey,
        readyTimeout: SSH_HANDSHAKE_TIMEOUT_MS,
        // Handshake only — never keep the channel open.
        keepaliveInterval: 0,
      })
    } catch (err) {
      finish({
        ok: false,
        errorCode: "config_error",
        message: err instanceof Error ? err.message : "Failed to start SSH connection.",
      })
    }
  })

function classifyDialError(
  err: NodeJS.ErrnoException & { level?: string },
  target: DialTarget
): { errorCode: VpnServerConnectionErrorCode; message: string } {
  const code = err.code
  const level = err.level

  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return {
      errorCode: "dns_failure",
      message: `DNS resolution failed for ${target.host}.`,
    }
  }
  if (
    level === "client-timeout" ||
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED" ||
    code === "EHOSTUNREACH" ||
    code === "ECONNRESET"
  ) {
    const reason =
      code === "ECONNREFUSED"
        ? "Connection refused"
        : code === "EHOSTUNREACH"
          ? "Host unreachable"
          : "Connection timed out"
    return {
      errorCode: "connection_timeout",
      message: `${reason} (${target.host}:${target.port}).`,
    }
  }
  if (level === "client-authentication") {
    return {
      errorCode: "auth_failure",
      message: "SSH key rejected by server — verify the key is deployed.",
    }
  }
  return {
    errorCode: "protocol_error",
    message:
      err.message ||
      `Unexpected SSH error on ${target.host}:${target.port} (possibly a non-SSH service).`,
  }
}

type KeyResolver = (sshKeyId: string) => Promise<string | null>

export type VpnServerConnectionTesterDeps = {
  /** Returns the decrypted private key PEM for the given SSH key id. */
  resolveKey?: KeyResolver
  dial?: SshDialer
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
 * Build a connection tester. Hostname is tried first; if DNS resolution fails
 * and an ipAddress fallback is configured, the IP is tried next. The result
 * keeps `reachable` + `message` for the existing UI contract and adds
 * `latencyMs`, `errorCode`, and fallback metadata.
 */
export function createVpnServerConnectionTester(
  deps: VpnServerConnectionTesterDeps = {}
): VpnServerConnectionTester {
  const resolveKey = deps.resolveKey ?? defaultResolveKey()
  const dial = deps.dial ?? defaultDial

  return async (server) => {
    const checkedAt = new Date().toISOString()
    const hostname = server.hostname?.trim() || undefined
    const ipAddress = server.ipAddress?.trim() || undefined

    const primary = hostname || ipAddress
    if (!primary) {
      return {
        reachable: false,
        message: "Server has no hostname or IP address configured.",
        checkedAt,
        errorCode: "config_error",
      }
    }

    let privateKey: string
    try {
      const resolved = await resolveKey(server.sshKeyId)
      if (!resolved) {
        return {
          reachable: false,
          message: "Stored SSH key could not be found for this server.",
          checkedAt,
          errorCode: "config_error",
        }
      }
      privateKey = resolved
    } catch {
      return {
        reachable: false,
        message: "Stored SSH key could not be decrypted.",
        checkedAt,
        errorCode: "config_error",
      }
    }

    const base = {
      port: server.sshPort,
      username: server.sshUser,
      privateKey,
    }

    const primaryOutcome = await dial({ host: primary, ...base })
    if (primaryOutcome.ok) {
      return {
        reachable: true,
        message: `Server reachable via SSH (${primaryOutcome.latencyMs}ms).`,
        checkedAt,
        latencyMs: primaryOutcome.latencyMs,
        usedAddress: primary,
      }
    }

    // DNS failure on the hostname → retry with the IP fallback if available.
    const shouldFallback =
      primaryOutcome.errorCode === "dns_failure" &&
      ipAddress !== undefined &&
      ipAddress !== primary

    if (!shouldFallback) {
      return {
        reachable: false,
        message: primaryOutcome.message,
        checkedAt,
        errorCode: primaryOutcome.errorCode,
        usedAddress: primary,
        fallbackIp:
          primaryOutcome.errorCode === "dns_failure" ? ipAddress : undefined,
      }
    }

    const fallbackOutcome = await dial({ host: ipAddress, ...base })
    if (fallbackOutcome.ok) {
      return {
        reachable: true,
        message: `Server reachable via SSH IP fallback ${ipAddress} (${fallbackOutcome.latencyMs}ms).`,
        checkedAt,
        latencyMs: fallbackOutcome.latencyMs,
        usedAddress: ipAddress,
        fallbackIp: ipAddress,
      }
    }

    return {
      reachable: false,
      message: `${primaryOutcome.message} IP fallback ${ipAddress} also failed: ${fallbackOutcome.message}`,
      checkedAt,
      errorCode: fallbackOutcome.errorCode,
      usedAddress: ipAddress,
      fallbackIp: ipAddress,
    }
  }
}

export const testVpnServerConnection: VpnServerConnectionTester =
  createVpnServerConnectionTester()

// ---------------------------------------------------------------------------
// SSH-based port verification (Story 12e)
// ---------------------------------------------------------------------------

/** A port found listening on the server via `ss -ntulp`. */
export type ListeningPort = {
  transport: "tcp" | "udp"
  port: number
  processName: string // e.g. "docker-proxy", "sshd", "openvpn"
  pid: number
}

/** SSH exec result: run a command and return stdout/stderr. */
export type SshExecResult = {
  ok: true
  stdout: string
  stderr: string
}

/** Target for an SSH exec connection. */
export type SshExecTarget = {
  host: string
  port: number
  username: string
  privateKey: string
}

/** SSH execer: runs a read-only command over an SSH channel. */
export type SshExecer = (target: SshExecTarget) => Promise<SshExecResult>

/** Max time to wait for the `ss` exec before failing fast. */
export const SSH_EXEC_TIMEOUT_MS = 10_000

/**
 * Parse `ss -ntulp` output into structured listening port entries.
 *
 * Input format (Linux ss -ntulp):
 *   udp   UNCONN  0  0    0.0.0.0:1194    0.0.0.0:*    users:(("docker-proxy",pid=12150,fd=8))
 *   tcp   LISTEN  0  128  0.0.0.0:22      0.0.0.0:*    users:(("sshd",pid=848,fd=6))
 *
 * Handles IPv4 (0.0.0.0:port) and IPv6 ([::]:port) local addresses. Returns an
 * empty array on parse errors (never throws).
 */
export function parseSsOutput(stdout: string): ListeningPort[] {
  const ports: ListeningPort[] = []
  if (!stdout) return ports
  const lines = stdout.trim().split("\n")

  for (const line of lines) {
    const parts = line.trim().split(/\s+/)
    if (parts.length < 5) continue

    const transport = parts[0] as "tcp" | "udp"
    if (transport !== "tcp" && transport !== "udp") continue

    // Local Address:Port column — handle IPv6 [::]:port and IPv4 0.0.0.0:port.
    const localAddr = parts[4]
    const portMatch = localAddr.match(/:(\d+)$/)
    if (!portMatch) continue
    const port = Number.parseInt(portMatch[1], 10)
    if (Number.isNaN(port)) continue

    // Parse users column: users:(("process",pid=1234,fd=N)).
    let processName = ""
    let pid = 0
    const usersCol = parts.slice(5).join(" ")
    const userMatch = usersCol.match(/"([^"]+)",pid=(\d+)/)
    if (userMatch) {
      processName = userMatch[1]
      pid = Number.parseInt(userMatch[2], 10)
      if (Number.isNaN(pid)) pid = 0
    }

    ports.push({ transport, port, processName, pid })
  }

  return ports
}

/**
 * Default SSH execer: open an SSH channel, run `ss -ntulp` (the only command
 * ever executed), collect stdout/stderr, then close. Never throws — failures
 * surface as a result with empty stdout and a stderr explanation.
 */
export const defaultSshExec: SshExecer = (target) =>
  new Promise<SshExecResult>((resolve) => {
    const client = new Client()
    let settled = false

    const finish = (result: SshExecResult) => {
      if (settled) return
      settled = true
      try {
        client.end()
      } catch {
        // ignore teardown errors
      }
      resolve(result)
    }

    const timeout = setTimeout(() => {
      finish({ ok: true, stdout: "", stderr: "SSH exec timed out" })
    }, SSH_EXEC_TIMEOUT_MS)

    const done = (result: SshExecResult) => {
      clearTimeout(timeout)
      finish(result)
    }

    client.on("ready", () => {
      client.exec("ss -ntulp", (err, channel) => {
        if (err) {
          done({ ok: true, stdout: "", stderr: err.message })
          return
        }

        let stdout = ""
        let stderr = ""

        channel.on("data", (data: Buffer) => {
          stdout += data.toString()
        })
        channel.stderr.on("data", (data: Buffer) => {
          stderr += data.toString()
        })
        channel.on("close", () => {
          done({ ok: true, stdout, stderr })
        })
      })
    })

    client.on("error", (err: Error) => {
      done({ ok: true, stdout: "", stderr: err.message })
    })

    try {
      client.connect({
        host: target.host,
        port: target.port,
        username: target.username,
        privateKey: target.privateKey,
        readyTimeout: SSH_EXEC_TIMEOUT_MS,
        keepaliveInterval: 0,
      })
    } catch (err) {
      done({
        ok: true,
        stdout: "",
        stderr: err instanceof Error ? err.message : "Failed to start SSH exec.",
      })
    }
  })
