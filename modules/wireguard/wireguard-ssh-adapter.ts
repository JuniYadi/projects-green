import {
  VpnServerSshExecutor,
} from "@/modules/vpn/provisioning/vpn-server-ssh-executor"
import type { SshTarget } from "./wireguard.types"
import type { WgPeer } from "./wireguard.types"

const USERNAME_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_-]{2,63}$/

function sanitizeUsername(username: string): string {
  if (!USERNAME_PATTERN.test(username)) {
    throw new Error("Invalid WireGuard peer username")
  }
  return username
}

function parseWgDump(stdout: string): { serverKey: string; peers: WgPeer[] } {
  const lines = stdout.trim().split("\n").filter(Boolean)
  if (lines.length === 0) return { serverKey: "", peers: [] }

  const serverKey = lines[0].split("\t")[0] ?? ""

  const peers: WgPeer[] = lines.slice(1).map((line) => {
    const parts = line.split("\t")
    // tab-separated: pubkey preshared-key endpoint allowed-ips handshake rx tx keepalive
    const endpoint = parts[2] ?? ""
    const allowedIps = parts[3] ?? ""
    const handshakeTs = Number(parts[4] ?? 0)
    const rx = Number(parts[5] ?? 0)
    const tx = Number(parts[6] ?? 0)

    // Extract username from comment or use pubkey prefix
    const ip = allowedIps.split(",")[0]?.trim() ?? allowedIps
    const pubkey = parts[0] ?? "unknown"
    const username = pubkey.substring(0, Math.min(8, pubkey.length))  // pubkey prefix as fallback

    return {
      username,
      ip,
      status: handshakeTs > 0 ? "online" : "offline",
      handshake: handshakeTs > 0 ? new Date(handshakeTs * 1000).toISOString() : null,
      rx,
      tx,
      endpoint: endpoint || null,
    }
  })

  return { serverKey, peers }
}

/**
 * WireGuard SSH adapter.
 *
 * Executes WireGuard management commands on the remote server over SSH.
 * Uses VpnServerSshExecutor (same as OpenVPN adapter pattern).
 */
export class WireGuardSshAdapter {
  private readonly executor: VpnServerSshExecutor
  private readonly addScript: string
  private readonly removeScript: string
  private readonly clientDir: string

  constructor(options: {
    executor?: VpnServerSshExecutor
    addScript?: string
    removeScript?: string
    clientDir?: string
  } = {}) {
    this.executor = options.executor ?? new VpnServerSshExecutor()
    this.addScript = options.addScript ?? "/root/wg-add.sh"
    this.removeScript = options.removeScript ?? "/root/wg-remove.sh"
    this.clientDir = options.clientDir ?? "/root/wireguard/clients"
  }

  async listPeers(target: SshTarget): Promise<WgPeer[]> {
    const result = await this.executor.execChecked(
      target,
      ["wg", "show", "wg0", "dump"],
      "list WireGuard peers"
    )
    return parseWgDump(result.stdout).peers
  }

  async createPeer(target: SshTarget, username: string): Promise<{ config: string }> {
    const safeName = sanitizeUsername(username)
    await this.executor.execChecked(
      target,
      ["bash", this.addScript, safeName],
      "create WireGuard peer"
    )
    // ponytail: assumes config lands at predictable path; change path if server layout differs
    const configResult = await this.executor.execChecked(
      target,
      ["cat", `${this.clientDir}/${safeName}.conf`],
      "read WireGuard config"
    )
    return { config: configResult.stdout }
  }

  async removePeer(target: SshTarget, username: string): Promise<void> {
    const safeName = sanitizeUsername(username)
    await this.executor.execChecked(
      target,
      ["bash", this.removeScript, safeName],
      "remove WireGuard peer"
    )
  }

  async fetchConfig(target: SshTarget, username: string): Promise<string> {
    const safeName = sanitizeUsername(username)
    const result = await this.executor.execChecked(
      target,
      ["cat", `${this.clientDir}/${safeName}.conf`],
      "fetch WireGuard config"
    )
    return result.stdout
  }
}
