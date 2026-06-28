import { Client } from "ssh2"

import { decryptSshPrivateKey } from "@/modules/vpn/admin/vpn-ssh-key.crypto"

export type SshCommandResult = {
  stdout: string
  stderr: string
  exitCode: number
}

/** SSH-layer error classification for better error messages. */
export type SshErrorType =
  | { type: "timeout"; host: string }
  | { type: "auth_failure"; host: string; message: string }
  | { type: "unreachable"; host: string; message: string }
  | { type: "command_failed"; host: string; exitCode: number; stderr: string }
  | { type: "unknown"; message: string }

export function classifySshError(
  result: SshCommandResult,
  host: string
): SshErrorType {
  // SSH connection timeout
  if (result.stderr === "SSH exec timed out") {
    return { type: "timeout", host }
  }
  // SSH auth failure
  if (
    result.stderr.includes("Authentication failed") ||
    result.stderr.includes("auth fail")
  ) {
    return { type: "auth_failure", host, message: result.stderr }
  }
  // DNS/connect failure
  if (
    result.stderr.includes("ENOTFOUND") ||
    result.stderr.includes("EAI_AGAIN") ||
    result.stderr.includes("ECONNREFUSED")
  ) {
    return { type: "unreachable", host, message: result.stderr }
  }
  // Remote command failed
  if (result.exitCode !== 0) {
    return { type: "command_failed", host, exitCode: result.exitCode, stderr: result.stderr }
  }
  return { type: "unknown", message: result.stderr || "Unknown SSH error" }
}

export function formatSshError(error: SshErrorType, action: string): string {
  switch (error.type) {
    case "timeout":
      return `SSH connection to ${error.host} timed out after 30s while ${action}`
    case "auth_failure":
      return `SSH key rejected by ${error.host}: ${error.message}`
    case "unreachable":
      return `Cannot reach ${error.host}: ${error.message}`
    case "command_failed":
      return `Remote command failed on ${error.host} (exit ${error.exitCode}): ${error.stderr}`
    case "unknown":
      return `Failed to ${action}: ${error.message}`
  }
}

export type SshTarget = {
  host: string
  /**
   * Fallback IP address to try when `host` (hostname) cannot be resolved.
   * Matches the hostname→ip fallback in vpn-server-connection.ts.
   */
  ipAddress?: string
  user: string
  /** Encrypted SSH private key as stored on VpnSshKey.privateKey. */
  encryptedPrivateKey: string
}

/** Timeout for the SSH connection + command exec. */
const SSH_EXEC_TIMEOUT_MS = 30_000

/**
 * Execute a remote command on a VPN server over SSH using its stored,
 * encrypted private key. Uses ssh2 (same library as the admin connection
 * tester) instead of spawning a CLI ssh process — avoids key format
 * differences between the ssh2 parser and the OpenSSH CLI.
 */
export class VpnServerSshExecutor {
  async exec(
    target: SshTarget,
    remoteArgs: string[]
  ): Promise<SshCommandResult> {
    return this.execInternal(target.host, target, remoteArgs, new Set())
  }

  private async execInternal(
    host: string,
    target: SshTarget,
    remoteArgs: string[],
    visited: Set<string>
  ): Promise<SshCommandResult> {
    if (!host.trim()) throw new Error("Server hostname is not configured.")
    if (visited.has(host)) throw new Error(`Circular SSH target: ${host}`)
    visited.add(host)

    const privateKey = decryptSshPrivateKey(target.encryptedPrivateKey)
    const command = remoteArgs.join(" ")

    return new Promise<SshCommandResult>((resolve) => {
      const client = new Client()
      let settled = false

      const finish = (result: SshCommandResult) => {
        if (settled) return
        settled = true
        try {
          client.end()
        } catch {
          /* ignore */
        }
        resolve(result)
      }

      const timeout = setTimeout(() => {
        finish({ stdout: "", stderr: "SSH exec timed out", exitCode: 1 })
      }, SSH_EXEC_TIMEOUT_MS)

      client.on("ready", () => {
        client.exec(command, (err, channel) => {
          if (err) {
            clearTimeout(timeout)
            finish({ stdout: "", stderr: err.message, exitCode: 1 })
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
          channel.on("close", (code?: number) => {
            clearTimeout(timeout)
            finish({ stdout, stderr, exitCode: code ?? 0 })
          })
        })
      })

      client.on("error", (err) => {
        clearTimeout(timeout)

        // ponytail: hostname→ip fallback on DNS failure (matches admin
        // connection tester in vpn-server-connection.ts).
        const code = (err as NodeJS.ErrnoException).code
        if (
          (code === "ENOTFOUND" || code === "EAI_AGAIN") &&
          target.ipAddress &&
          target.ipAddress !== host
        ) {
          client.end()
          this.execInternal(target.ipAddress, target, remoteArgs, visited).then(
            resolve
          )
          return
        }

        finish({ stdout: "", stderr: err.message, exitCode: 1 })
      })

      try {
        client.connect({
          host,
          username: target.user,
          privateKey,
          readyTimeout: SSH_EXEC_TIMEOUT_MS,
          keepaliveInterval: 0,
        })
      } catch (err) {
        clearTimeout(timeout)
        finish({
          stdout: "",
          stderr:
            err instanceof Error ? err.message : "Failed to start SSH",
          exitCode: 1,
        })
      }
    })
  }

  async execChecked(
    target: SshTarget,
    remoteArgs: string[],
    action: string
  ): Promise<SshCommandResult> {
    const result = await this.exec(target, remoteArgs)
    if (result.exitCode !== 0) {
      const classified = classifySshError(result, target.host)
      throw new Error(formatSshError(classified, action))
    }
    return result
  }
}
