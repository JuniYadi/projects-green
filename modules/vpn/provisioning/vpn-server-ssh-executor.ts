import { Client } from "ssh2"

import { decryptSshPrivateKey } from "@/modules/vpn/admin/vpn-ssh-key.crypto"

export type SshCommandResult = {
  stdout: string
  stderr: string
  exitCode: number
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
          channel.on("close", () => {
            clearTimeout(timeout)
            finish({ stdout, stderr, exitCode: 0 })
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
      throw new Error(`Failed to ${action}: ${result.stderr.trim()}`)
    }
    return result
  }
}
