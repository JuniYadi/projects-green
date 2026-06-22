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
 * Generates a peer keypair on the server (`wg genkey | wg pubkey`), registers
 * the peer against the server's interface, and renders a client `.conf`. The
 * remote helper script is expected at `WIREGUARD_ADD_PEER_SCRIPT` and must
 * accept `<peerName>` and print the client config to stdout.
 */
export class WireGuardSshAdapter {
  private readonly executor: VpnServerSshExecutor
  private readonly addPeerScript: string

  constructor(
    options: {
      executor?: VpnServerSshExecutor
      addPeerScript?: string
    } = {}
  ) {
    this.executor = options.executor ?? new VpnServerSshExecutor()
    this.addPeerScript =
      options.addPeerScript ??
      process.env.WIREGUARD_ADD_PEER_SCRIPT ??
      "/usr/local/bin/add-wireguard-peer"
  }

  async createPeer(
    target: SshTarget,
    username: string
  ): Promise<WireGuardProvisionResult> {
    const safeName = sanitizeUsername(username)
    const result = await this.executor.execChecked(
      target,
      [this.addPeerScript, safeName],
      "create WireGuard peer"
    )
    const config = result.stdout.trim()
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
      this.addPeerScript,
      "--exists",
      safeName,
    ])

    if (result.exitCode === 0) {
      return { exists: true, message: "WireGuard peer exists on server." }
    }

    return {
      exists: false,
      message:
        result.stderr.trim() ||
        result.stdout.trim() ||
        "WireGuard peer was not found on server.",
    }
  }

  async revokePeer(target: SshTarget, username: string): Promise<void> {
    const safeName = sanitizeUsername(username)
    await this.executor.execChecked(
      target,
      [this.addPeerScript, "--revoke", safeName],
      "revoke WireGuard peer"
    )
  }
}
