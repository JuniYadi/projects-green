import { VpnServerSshExecutor, type SshTarget } from "./vpn-server-ssh-executor"

const USERNAME_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_-]{2,63}$/

function sanitizeUsername(username: string): string {
  if (!USERNAME_PATTERN.test(username)) {
    throw new Error("Invalid WireGuard peer username")
  }
  return username
}

export type WireGuardProvisionResult = {
  config: string
}

export type WireGuardValidationResult = {
  exists: boolean
  message: string
}

/**
 * WireGuard provisioning over SSH.
 *
 * Runs the server's wg-add.sh to create a peer, then reads the resulting
 * .conf file from the clients directory.
 *
 * Server scripts expected:
 *   - `/root/wg-add.sh <username>`  — creates peer, writes .conf to clients dir
 *   - `/root/wg-remove.sh <username>` — removes peer and its .conf
 *
 * Client configs are stored at:
 *   `/root/wireguard/clients/<username>.conf`
 *
 * Paths can be overridden via constructor options or environment variables:
 *   WIREGUARD_ADD_PEER_SCRIPT, WIREGUARD_REMOVE_PEER_SCRIPT, WIREGUARD_CLIENT_DIR
 */
export class WireGuardSshAdapter {
  private readonly executor: VpnServerSshExecutor
  private readonly addScript: string
  private readonly removeScript: string
  private readonly clientDir: string

  constructor(
    options: {
      executor?: VpnServerSshExecutor
      addScript?: string
      removeScript?: string
      clientDir?: string
    } = {}
  ) {
    this.executor = options.executor ?? new VpnServerSshExecutor()
    this.addScript =
      options.addScript ??
      process.env.WIREGUARD_ADD_PEER_SCRIPT ??
      "/root/wg-add.sh"
    this.removeScript =
      options.removeScript ??
      process.env.WIREGUARD_REMOVE_PEER_SCRIPT ??
      "/root/wg-remove.sh"
    this.clientDir =
      options.clientDir ??
      process.env.WIREGUARD_CLIENT_DIR ??
      "/root/wireguard/clients"
  }

  async createPeer(
    target: SshTarget,
    username: string
  ): Promise<WireGuardProvisionResult> {
    const safeName = sanitizeUsername(username)

    // Step 1: Run the add script to create the peer and write the .conf file
    await this.executor.execChecked(
      target,
      ["bash", this.addScript, safeName],
      "create WireGuard peer"
    )

    // Step 2: Read the config file the script wrote to the clients directory
    const configResult = await this.executor.execChecked(
      target,
      ["cat", `${this.clientDir}/${safeName}.conf`],
      "read WireGuard peer config"
    )

    const config = configResult.stdout.trim()
    if (!config.includes("[Interface]")) {
      throw new Error("WireGuard config was not returned by the server")
    }

    return { config }
  }

  async validatePeer(
    target: SshTarget,
    username: string
  ): Promise<WireGuardValidationResult> {
    const safeName = sanitizeUsername(username)
    const result = await this.executor.exec(target, [
      "test",
      "-f",
      `${this.clientDir}/${safeName}.conf`,
    ])

    if (result.exitCode === 0) {
      return { exists: true, message: "WireGuard peer exists on server." }
    }

    return {
      exists: false,
      message: `WireGuard peer '${safeName}' not found on server.`,
    }
  }

  async revokePeer(target: SshTarget, username: string): Promise<void> {
    const safeName = sanitizeUsername(username)
    await this.executor.execChecked(
      target,
      ["bash", this.removeScript, safeName],
      "revoke WireGuard peer"
    )
  }
}
