import { spawn } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { decryptSshPrivateKey } from "@/modules/vpn/admin/vpn-ssh-key.crypto"

export type SshCommandResult = {
  stdout: string
  stderr: string
  exitCode: number
}

export type SshCommandRunner = (
  command: string,
  args: string[]
) => Promise<SshCommandResult>

export type SshTarget = {
  host: string
  user: string
  /** Encrypted SSH private key as stored on VpnSshKey.privateKey. */
  encryptedPrivateKey: string
}

function defaultRun(
  command: string,
  args: string[]
): Promise<SshCommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk))
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk))
    child.on("error", reject)
    child.on("close", (exitCode) => {
      resolve({
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        exitCode: exitCode ?? 1,
      })
    })
  })
}

/**
 * Execute a remote command on a VPN server over SSH using its stored,
 * encrypted private key. The key is decrypted to a 0600 temp file for the
 * lifetime of the call and removed afterwards.
 *
 * `remoteArgs` are passed verbatim after `--`, so callers MUST sanitize any
 * untrusted input before building the argument list.
 */
export class VpnServerSshExecutor {
  private readonly run: SshCommandRunner

  constructor(options: { run?: SshCommandRunner } = {}) {
    this.run = options.run ?? defaultRun
  }

  async exec(
    target: SshTarget,
    remoteArgs: string[]
  ): Promise<SshCommandResult> {
    if (!target.host.trim())
      throw new Error("Server hostname is not configured.")

    const privateKey = decryptSshPrivateKey(target.encryptedPrivateKey)
    const dir = await mkdtemp(join(tmpdir(), "vpn-ssh-"))
    const keyPath = join(dir, "id_key")

    try {
      await writeFile(keyPath, privateKey, { mode: 0o600 })
      const result = await this.run("ssh", [
        "-i",
        keyPath,
        "-o",
        "BatchMode=yes",
        "-o",
        "StrictHostKeyChecking=yes",
        `${target.user}@${target.host}`,
        "--",
        ...remoteArgs,
      ])
      return result
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
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
