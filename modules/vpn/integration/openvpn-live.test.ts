/**
 * Live verification script for the OpenVPN SSH adapter.
 *
 * Runs every adapter method against a real OpenVPN server using env vars.
 * Cleans up created client in a `finally` block.
 *
 * Usage (from project root):
 *   OPENVPN_LIVE_TEST_HOST="203.0.113.1" \
 *   OPENVPN_LIVE_TEST_USER="root" \
 *   OPENVPN_LIVE_TEST_KEY="$(cat ~/.ssh/id_ed25519)" \
 *   ENCRYPTION_KEY="..." \
 *   bun test modules/vpn/integration/openvpn-live.test.ts
 *
 * The key is encrypted with ENCRYPTION_KEY before being passed to
 * VpnServerSshExecutor (which always decrypts). Set ENCRYPTION_KEY to
 * the same 32-byte-hex value used in production.
 */
import { beforeEach, describe, expect, it } from "bun:test"

import { encryptSshPrivateKey } from "@/modules/vpn/admin/vpn-ssh-key.crypto"
import { OpenVpnSshAdapter } from "@/modules/vpn/openvpn/openvpn-ssh-adapter"
import { VpnServerSshExecutor } from "@/modules/vpn/provisioning/vpn-server-ssh-executor"
import type { SshTarget } from "@/modules/vpn/provisioning/vpn-server-ssh-executor"

const HOST = process.env.OPENVPN_LIVE_TEST_HOST
const USER = process.env.OPENVPN_LIVE_TEST_USER
const KEY = process.env.OPENVPN_LIVE_TEST_KEY

const clientName = `pgreen-live-${Date.now()}`

let target: SshTarget | null = null
let adapter: OpenVpnSshAdapter | null = null

function buildTarget(): SshTarget {
  if (!HOST || !USER || !KEY) {
    throw new Error(
      "Set OPENVPN_LIVE_TEST_HOST, OPENVPN_LIVE_TEST_USER, and OPENVPN_LIVE_TEST_KEY"
    )
  }
  return {
    host: HOST,
    user: USER,
    encryptedPrivateKey: encryptSshPrivateKey(KEY),
  }
}

describe("openvpn-live", () => {
  beforeEach(() => {
    target = buildTarget()
    adapter = new OpenVpnSshAdapter()
  })

  it("runs full lifecycle against live server", async () => {
    const host = HOST!
    const name = clientName
    const log: string[] = []

    const push = (step: string, raw: unknown) =>
      log.push(`[${step}] ${JSON.stringify(raw)}`)

    try {
      // 1 — health check first (read-only)
      const health = await adapter!.healthCheck(target!)
      push("healthCheck", health)
      expect(typeof health.ok).toBe("boolean")

      // 2 — validate connection by listing clients
      const clients = await adapter!.listClients(target!)
      push("listClients", { count: clients.length })

      // 3 — create throwaway client
      await adapter!.createClient(target!, name)
      push("createClient", { clientName: name })

      // 4 — fetch the .ovpn config
      const config = await adapter!.fetchConfig(target!, name)
      push("fetchConfig", { length: config.length, preview: config.slice(0, 80) })
      expect(config).toContain("client")
      expect(config).toContain("dev tun")

      // 5 — validate the client exists on disk
      const validation = await adapter!.validateClient(target!, name)
      push("validateClient", validation)
      expect(validation.exists).toBe(true)

      // 6 — revoke the client
      await adapter!.revokeClient(target!, name)
      push("revokeClient", { clientName: name })

      // 7 — remove the cert
      await adapter!.removeClient(target!, name)
      push("removeClient", { clientName: name })
    } finally {
      // Print raw output for documentation purposes
      for (const line of log) console.log(line)

      // Cleanup: if createClient succeeded but revoke/remove may have failed,
      // try a direct SSH cleanup fallback
      if (adapter && target) {
        try {
          const stillExists = await adapter.validateClient(target, clientName)
          if (stillExists.exists) {
            console.log(`[cleanup] client ${clientName} still exists, revoking+removing`)
            await adapter.revokeClient(target, clientName)
            await adapter.removeClient(target, clientName)
          }
        } catch {
          // Best-effort cleanup
        }
      }
    }
  })
})
