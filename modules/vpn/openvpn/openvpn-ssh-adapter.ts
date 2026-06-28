import {
  VpnServerSshExecutor,
  type SshTarget,
} from "@/modules/vpn/provisioning/vpn-server-ssh-executor"

export type OpenVpnClientSummary = {
  clientName: string
  status: "ACTIVE" | "REVOKED" | "UNKNOWN"
  serial: string | null
  expiresAt: string | null
  ipAllocation: string | null
  connected: boolean
  realAddress: string | null
  virtualAddress: string | null
  bytesReceived: number | null
  bytesSent: number | null
  connectedSince: string | null
}

export type RemoteAccountValidationResult = {
  exists: boolean
  message: string
}

const CLIENT_NAME_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_-]{2,63}$/
const SCRIPT_PATH_PATTERN = /^\/[A-Za-z0-9_./-]+$/
const disconnectedState = {
  connected: false,
  realAddress: null,
  virtualAddress: null,
  bytesReceived: null,
  bytesSent: null,
  connectedSince: null,
} as const

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

export class OpenVpnSshAdapter {
  private readonly executor: VpnServerSshExecutor
  private readonly createScript: string
  private readonly revokeScript: string
  private readonly removeScript: string
  private readonly userListScript: string
  private readonly statusLogPath: string
  private readonly configDirectory: string
  private readonly dockerComposeFile: string

  constructor(options: {
    executor?: VpnServerSshExecutor
    createScript?: string
    revokeScript?: string
    removeScript?: string
    userListScript?: string
    statusLogPath?: string
    configDirectory?: string
    dockerComposeFile?: string
  } = {}) {
    this.executor = options.executor ?? new VpnServerSshExecutor()
    this.createScript =
      options.createScript ??
      process.env.OPENVPN_CREATE_CLIENT_SCRIPT ??
      "/root/genclient.sh"
    this.revokeScript =
      options.revokeScript ??
      process.env.OPENVPN_REVOKE_CLIENT_SCRIPT ??
      "/root/revoke.sh"
    this.removeScript =
      options.removeScript ??
      process.env.OPENVPN_REMOVE_CLIENT_SCRIPT ??
      "/root/rmcert.sh"
    this.userListScript =
      options.userListScript ??
      process.env.OPENVPN_USERLIST_SCRIPT ??
      "/root/userlist.sh"
    this.statusLogPath =
      options.statusLogPath ??
      process.env.OPENVPN_STATUS_LOG_PATH ??
      "/root/openvpn/log/openvpn-status.log"
    this.configDirectory =
      options.configDirectory ??
      process.env.OPENVPN_CLIENT_CONFIG_DIR ??
      "/root/openvpn/clients"
    this.dockerComposeFile =
      options.dockerComposeFile ??
      process.env.OPENVPN_DOCKER_COMPOSE_FILE ??
      "/root/openvpn/docker-compose.yaml"
  }

  async createClient(target: SshTarget, clientName: string): Promise<void> {
    const safeName = sanitizeOpenVpnClientName(clientName)
    const script = assertSafeAbsolutePath(this.createScript, "create script")

    await this.executor.execChecked(
      target,
      ["bash", script, safeName],
      "create OpenVPN client"
    )

    // d3vilh/openvpn-server's generated client artifact is the .ovpn file.
    const validation = await this.validateClient(target, safeName)
    if (!validation.exists) {
      throw new Error(validation.message)
    }
  }

  async fetchConfig(target: SshTarget, clientName: string): Promise<string> {
    const safeName = sanitizeOpenVpnClientName(clientName)
    const directory = assertSafeAbsolutePath(
      this.configDirectory,
      "config directory"
    )

    const result = await this.executor.execChecked(
      target,
      ["cat", `${directory}/${safeName}.ovpn`],
      "fetch OpenVPN config"
    )

    return result.stdout
  }

  async validateClient(
    target: SshTarget,
    clientName: string
  ): Promise<RemoteAccountValidationResult> {
    const safeName = sanitizeOpenVpnClientName(clientName)
    const directory = assertSafeAbsolutePath(
      this.configDirectory,
      "config directory"
    )
    const configPath = `${directory}/${safeName}.ovpn`
    const result = await this.executor.exec(target, ["test", "-f", configPath])

    if (result.exitCode === 0) {
      return {
        exists: true,
        message: `OpenVPN profile exists: ${configPath}`,
      }
    }

    return {
      exists: false,
      message: `OpenVPN profile not found on server: ${configPath}`,
    }
  }

  async revokeClient(target: SshTarget, clientName: string): Promise<void> {
    const safeName = sanitizeOpenVpnClientName(clientName)
    const script = assertSafeAbsolutePath(this.revokeScript, "revoke script")

    await this.executor.execChecked(
      target,
      ["bash", script, safeName],
      "revoke OpenVPN client"
    )
  }

  async removeClient(target: SshTarget, clientName: string): Promise<void> {
    const safeName = sanitizeOpenVpnClientName(clientName)
    const script = assertSafeAbsolutePath(this.removeScript, "remove script")

    await this.executor.execChecked(
      target,
      ["bash", script, safeName],
      "remove OpenVPN client certificate"
    )
  }

  async listClients(target: SshTarget): Promise<OpenVpnClientSummary[]> {
    const script = assertSafeAbsolutePath(this.userListScript, "userlist script")
    const result = await this.executor.execChecked(
      target,
      ["bash", script],
      "list OpenVPN users"
    )

    const connections = await this.listConnectedClients(target)
    const users: OpenVpnClientSummary[] = []
    let section: OpenVpnClientSummary["status"] | null = null

    for (const rawLine of result.stdout.split("\n")) {
      const line = rawLine.trim()
      if (!line || /^[-=]+$/.test(line)) continue

      if (/^===\s*ACTIVE USERS\s*===/i.test(line)) {
        section = "ACTIVE"
        continue
      }
      if (/^===\s*REVOKED USERS\s*===/i.test(line)) {
        section = "REVOKED"
        continue
      }
      if (/^USERNAME\s*\|/i.test(line)) continue
      if (/^Total\s+(active|revoked):/i.test(line)) continue

      if (/^user aktif(?: sekarang)?(?: \(\d+\))?:/i.test(line)) {
        const payload = line.replace(/^user aktif(?: sekarang)?(?: \(\d+\))?:\s*/i, "")
        for (const name of payload.split(",").map((value) => value.trim())) {
          const clientName = name.replace(/^[-*+]\s*/, "")
          if (clientName && !/^server cert$/i.test(clientName)) {
            users.push({
              clientName,
              status: "ACTIVE",
              serial: null,
              expiresAt: null,
              ipAllocation: null,
              ...(connections.get(clientName) ?? disconnectedState),
            })
          }
        }
        continue
      }

      if (!section) continue

      if (section === "ACTIVE") {
        const columns = line.split("|").map((value) => value.trim())
        const clientName = columns[0]
        if (clientName && !/^OpenVPNServer$/i.test(clientName)) {
          users.push({
            clientName,
            status: section,
            serial: columns[1] || null,
            expiresAt: columns[2] || null,
            ipAllocation: columns[3] || null,
            ...(connections.get(clientName) ?? disconnectedState),
          })
        }
        continue
      }

      const revokedMatch = line.match(/^(.+?)\s*\(([A-Fa-f0-9]+)\)$/)
      const clientName = revokedMatch?.[1]?.trim() ?? line
      const serial = revokedMatch?.[2] ?? null

      if (clientName) {
        users.push({
          clientName,
          status: section,
          serial,
          expiresAt: null,
          ipAllocation: null,
          ...(connections.get(clientName) ?? disconnectedState),
        })
      }
    }

    return Array.from(
      new Map(users.map((user) => [`${user.status}:${user.clientName}`, user])).values()
    )
  }

  private async listConnectedClients(target: SshTarget) {
    const path = assertSafeAbsolutePath(this.statusLogPath, "status log path")
    const result = await this.executor.exec(target, ["cat", path])
    const connected = new Map<string, Omit<OpenVpnClientSummary, "clientName" | "status" | "serial" | "expiresAt" | "ipAllocation">>()

    if (result.exitCode !== 0) return connected

    for (const rawLine of result.stdout.split("\n")) {
      const line = rawLine.trim()
      if (!line.startsWith("CLIENT_LIST,")) continue
      const parts = line.split(",")
      const clientName = parts[1]?.trim()
      if (!clientName) continue

      connected.set(clientName, {
        connected: true,
        realAddress: parts[2] || null,
        virtualAddress: parts[3] || null,
        bytesReceived: Number.isFinite(Number(parts[5])) ? Number(parts[5]) : null,
        bytesSent: Number.isFinite(Number(parts[6])) ? Number(parts[6]) : null,
        connectedSince: parts[7] || null,
      })
    }

    return connected
  }

  async restartServer(target: SshTarget): Promise<void> {
    await this.executor.execChecked(
      target,
      ["docker", "compose", "-f", this.dockerComposeFile, "restart", "openvpn"],
      "restart OpenVPN server"
    )
  }

  async healthCheck(target: SshTarget): Promise<{ ok: boolean; output: string }> {
    const result = await this.executor.exec(
      target,
      ["docker", "ps", "--filter", "name=openvpn", "--format", "{{.Names}}"]
    )

    // docker ps returns container name if running, empty if not
    const output = result.stdout.trim()
    const ok = result.exitCode === 0 && output === "openvpn"

    return { ok, output: ok ? "openvpn container running" : output || "container not running" }
  }
}
