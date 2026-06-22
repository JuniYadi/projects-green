import {
  VpnServerSshExecutor,
  type SshTarget,
} from "@/modules/vpn/provisioning/vpn-server-ssh-executor"

export type OpenVpnClientSummary = {
  clientName: string
  status: "ACTIVE" | "REVOKED" | "UNKNOWN"
}

export type RemoteAccountValidationResult = {
  exists: boolean
  message: string
}

const CLIENT_NAME_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_-]{2,63}$/
const SCRIPT_PATH_PATTERN = /^\/[A-Za-z0-9_./-]+$/

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
  private readonly configDirectory: string

  constructor(options: {
    executor?: VpnServerSshExecutor
    createScript?: string
    revokeScript?: string
    configDirectory?: string
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
    this.configDirectory =
      options.configDirectory ??
      process.env.OPENVPN_CLIENT_CONFIG_DIR ??
      "/root/openvpn/clients"
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

  async listClients(): Promise<OpenVpnClientSummary[]> {
    return []
  }

  async healthCheck(target: SshTarget): Promise<{ ok: boolean; output: string }> {
    const result = await this.executor.execChecked(
      target,
      ["systemctl", "is-active", "openvpn-server@server"],
      "check OpenVPN health"
    )

    return { ok: true, output: result.stdout.trim() }
  }
}
