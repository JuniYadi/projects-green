import { spawn } from "node:child_process"

export type OpenVpnCommandResult = {
  stdout: string
  stderr: string
  exitCode: number
}

export type OpenVpnCommandRunner = (
  command: string,
  args: string[],
) => Promise<OpenVpnCommandResult>

export type OpenVpnSshEnv = {
  host: string
  user: string
  privateKeyPath: string
  createScript: string
  revokeScript: string
  configDirectory: string
  healthCommand: string
}

export type OpenVpnClientSummary = {
  clientName: string
  status: "ACTIVE" | "REVOKED" | "UNKNOWN"
}

const CLIENT_NAME_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_-]{2,63}$/
const SCRIPT_PATH_PATTERN = /^\/[A-Za-z0-9_./-]+$/
const HEALTH_COMMANDS = new Map<string, string[]>([
  [
    "systemctl is-active openvpn-server@server",
    ["systemctl", "is-active", "openvpn-server@server"],
  ],
])

export function sanitizeOpenVpnClientName(clientName: string): string {
  if (!CLIENT_NAME_PATTERN.test(clientName)) {
    throw new Error("Invalid OpenVPN client name")
  }

  return clientName
}

function assertSafeAbsolutePath(path: string, label: string): string {
  if (!SCRIPT_PATH_PATTERN.test(path) || path.includes("..")) {
    throw new Error(`Invalid OpenVPN ${label} path`)
  }

  return path
}

function defaultRun(command: string, args: string[]): Promise<OpenVpnCommandResult> {
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

export class OpenVpnSshAdapter {
  private readonly env: OpenVpnSshEnv
  private readonly run: OpenVpnCommandRunner

  constructor(options: { env: OpenVpnSshEnv; run?: OpenVpnCommandRunner }) {
    this.env = options.env
    this.run = options.run ?? defaultRun
  }

  async createClient(clientName: string): Promise<void> {
    const safeName = sanitizeOpenVpnClientName(clientName)
    const script = assertSafeAbsolutePath(this.env.createScript, "create script")

    await this.runChecked([script, safeName], "create OpenVPN client")
  }

  async fetchConfig(clientName: string): Promise<string> {
    const safeName = sanitizeOpenVpnClientName(clientName)
    const directory = assertSafeAbsolutePath(
      this.env.configDirectory,
      "config directory",
    )

    const result = await this.runChecked(
      ["cat", `${directory}/${safeName}.ovpn`],
      "fetch OpenVPN config",
    )

    return result.stdout
  }

  async revokeClient(clientName: string): Promise<void> {
    const safeName = sanitizeOpenVpnClientName(clientName)
    const script = assertSafeAbsolutePath(this.env.revokeScript, "revoke script")

    await this.runChecked([script, safeName], "revoke OpenVPN client")
  }

  async listClients(): Promise<OpenVpnClientSummary[]> {
    return []
  }

  async healthCheck(): Promise<{ ok: boolean; output: string }> {
    const remoteCommand = HEALTH_COMMANDS.get(this.env.healthCommand)

    if (!remoteCommand) {
      throw new Error("OpenVPN health command is not allowlisted")
    }

    const result = await this.runChecked(remoteCommand, "check OpenVPN health")

    return { ok: true, output: result.stdout.trim() }
  }

  private async runChecked(
    remoteArgs: string[],
    action: string,
  ): Promise<OpenVpnCommandResult> {
    const result = await this.run("ssh", [
      "-i",
      this.env.privateKeyPath,
      "-o",
      "BatchMode=yes",
      "-o",
      "StrictHostKeyChecking=yes",
      `${this.env.user}@${this.env.host}`,
      "--",
      ...remoteArgs,
    ])

    if (result.exitCode !== 0) {
      throw new Error(`Failed to ${action}`)
    }

    return result
  }
}

export function openVpnSshEnvFromProcessEnv(): OpenVpnSshEnv {
  return {
    host: process.env.OPENVPN_SSH_HOST ?? "",
    user: process.env.OPENVPN_SSH_USER ?? "",
    privateKeyPath: process.env.OPENVPN_SSH_PRIVATE_KEY_PATH ?? "",
    createScript:
      process.env.OPENVPN_CREATE_CLIENT_SCRIPT ??
      "/usr/local/bin/create-openvpn-client",
    revokeScript:
      process.env.OPENVPN_REVOKE_CLIENT_SCRIPT ??
      "/usr/local/bin/revoke-openvpn-client",
    configDirectory:
      process.env.OPENVPN_CLIENT_CONFIG_DIR ?? "/etc/openvpn/clients",
    healthCommand:
      process.env.OPENVPN_HEALTH_COMMAND ??
      "systemctl is-active openvpn-server@server",
  }
}
