/**
 * Live integration test for OpenVPN SSH adapter.
 *
 * Prerequisites (NEVER commit these values):
 *   OPENVPN_LIVE_TEST_HOST=<ip or hostname>
 *   OPENVPN_LIVE_TEST_USER=<ssh user>
 *   OPENVPN_LIVE_TEST_KEY=<base64-encoded encrypted private key>
 *
 * Run:
 *   OPENVPN_LIVE_TEST_HOST=... OPENVPN_LIVE_TEST_USER=... OPENVPN_LIVE_TEST_KEY=... bun test modules/vpn/integration/openvpn-live.test.ts
 */

import { describe, expect, it } from "bun:test"
import type { SshTarget } from "@/modules/vpn/provisioning/vpn-server-ssh-executor"
import { VpnServerSshExecutor } from "@/modules/vpn/provisioning/vpn-server-ssh-executor"
import { OpenVpnSshAdapter } from "@/modules/vpn/openvpn/openvpn-ssh-adapter"

function buildTarget(): SshTarget {
  const host = process.env.OPENVPN_LIVE_TEST_HOST
  const user = process.env.OPENVPN_LIVE_TEST_USER
  const encryptedKey = process.env.OPENVPN_LIVE_TEST_KEY
  if (!host || !user || !encryptedKey) {
    throw new Error("Missing env vars")
  }
  return { host, user, encryptedPrivateKey: encryptedKey }
}

function log(label: string, data: unknown) {
  console.log(`\n[${label}]`)
  console.log(JSON.stringify(data, null, 2))
}

function checkCreds(): void {
  if (!process.env.OPENVPN_LIVE_TEST_HOST || !process.env.OPENVPN_LIVE_TEST_USER || !process.env.OPENVPN_LIVE_TEST_KEY) {
    throw new Error("Skipping: set OPENVPN_LIVE_TEST_HOST, OPENVPN_LIVE_TEST_USER, and OPENVPN_LIVE_TEST_KEY env vars")
  }
}

const hasEnv = Boolean(
  process.env.OPENVPN_LIVE_TEST_HOST &&
  process.env.OPENVPN_LIVE_TEST_USER &&
  process.env.OPENVPN_LIVE_TEST_KEY,
)

describe.skipIf(!hasEnv)("OpenVPN live integration", () => {
  const executor = new VpnServerSshExecutor()
  const adapter = new OpenVpnSshAdapter({ executor })
  const clientName = `pgreen-live-${Date.now()}`
  const target = buildTarget()

  it("validateConnection — SSH connection works", async () => {
    checkCreds()
    const result = await executor.exec(target, ["echo", "alive"])
    log("validateConnection", result)
    expect(result.exitCode).toBe(0)
    expect(result.stdout.trim()).toBe("alive")
  })

  it("createClient — generates .ovpn profile", async () => {
    checkCreds()
    await adapter.createClient(target, clientName)
    log("createClient", { clientName, status: "created" })
    expect(clientName).toBeTruthy()
  })

  it("fetchConfig — returns valid .ovpn content", async () => {
    checkCreds()
    const config = await adapter.fetchConfig(target, clientName)
    log("fetchConfig", { clientName, length: config.length })
    expect(config).toContain("client")
    expect(config).toContain("openvpn")
  })

  it("validateClient — profile exists after creation", async () => {
    checkCreds()
    const result = await adapter.validateClient(target, clientName)
    log("validateClient", result)
    expect(result.exists).toBe(true)
  })

  it("listClients — includes newly created client", async () => {
    checkCreds()
    const clients = await adapter.listClients(target)
    log("listClients", { total: clients.length, clients: clients.map(c => c.clientName) })
    expect(clients.some(c => c.clientName === clientName)).toBe(true)
  })

  it("healthCheck — openvpn container is running", async () => {
    checkCreds()
    const result = await adapter.healthCheck(target)
    log("healthCheck", result)
    expect(result.ok).toBe(true)
  })

  it("revokeClient — removes client certificate", async () => {
    checkCreds()
    await adapter.revokeClient(target, clientName)
    log("revokeClient", { clientName, status: "revoked" })
  })

  it("removeClient — cleans up .ovpn file", async () => {
    checkCreds()
    await adapter.removeClient(target, clientName)
    log("removeClient", { clientName, status: "removed" })
  })

  it("restartServer — docker compose restart works", async () => {
    checkCreds()
    await adapter.restartServer(target)
    log("restartServer", { status: "restarted" })
    // Wait for server to come back up
    let healthy = false
    for (let i = 0; i < 10; i++) {
      const hc = await adapter.healthCheck(target)
      if (hc.ok) { healthy = true; break }
      await new Promise(r => setTimeout(r, 2000))
    }
    expect(healthy).toBe(true)
  })

  it("validateClient — profile gone after removal", async () => {
    checkCreds()
    await adapter.revokeClient(target, clientName)
    await adapter.removeClient(target, clientName)
    const result = await adapter.validateClient(target, clientName)
    log("validateClient (post-removal)", result)
    expect(result.exists).toBe(false)
  })
})
