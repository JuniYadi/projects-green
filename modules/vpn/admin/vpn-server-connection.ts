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
    const hostname = server.hostname.trim()
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
