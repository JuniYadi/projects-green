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

const host = process.env.OPENVPN_LIVE_TEST_HOST
const user = process.env.OPENVPN_LIVE_TEST_USER
const encryptedKey = process.env.OPENVPN_LIVE_TEST_KEY

function skipIfNoCreds() {
  if (!host || !user || !encryptedKey) {
    throw new Error(
      "Skipping: set OPENVPN_LIVE_TEST_HOST, OPENVPN_LIVE_TEST_USER, and OPENVPN_LIVE_TEST_KEY env vars"
    )
  }
}

function buildTarget(): SshTarget {
  return { host, user, encryptedPrivateKey: encryptedKey! }
}

function log(label: string, data: unknown) {
  console.log(`\n[${label}]`)
  console.log(JSON.stringify(data, null, 2))
}

describe("OpenVPN live integration", { skip: !host || !user || !encryptedKey }, () => {
  const executor = new VpnServerSshExecutor()
  const adapter = new OpenVpnSshAdapter({ executor })
  const clientName = `pgreen-live-${Date.now()}`
  const target = buildTarget()

  it("validateConnection — SSH connection works", async () => {
    skipIfNoCreds()
    const result = await executor.exec(target, ["echo", "alive"])
    log("validateConnection", result)
    expect(result.exitCode).toBe(0)
    expect(result.stdout.trim()).toBe("alive")
  })

  it("createClient — generates .ovpn profile", async () => {
    skipIfNoCreds()
    await adapter.createClient(target, clientName)
    log("createClient", { clientName, status: "created" })
    expect(clientName).toBeTruthy()
  })

  it("fetchConfig — returns valid .ovpn content", async () => {
    skipIfNoCreds()
    const config = await adapter.fetchConfig(target, clientName)
    log("fetchConfig", { clientName, length: config.length })
    expect(config).toContain("client")
    expect(config).toContain("openvpn")
  })

  it("validateClient — profile exists after creation", async () => {
    skipIfNoCreds()
    const result = await adapter.validateClient(target, clientName)
    log("validateClient", result)
    expect(result.exists).toBe(true)
  })

  it("listClients — includes newly created client", async () => {
    skipIfNoCreds()
    const clients = await adapter.listClients(target)
    log("listClients", { total: clients.length, clients: clients.map(c => c.clientName) })
    expect(clients.some(c => c.clientName === clientName)).toBe(true)
  })

  it("healthCheck — openvpn container is running", async () => {
    skipIfNoCreds()
    const result = await adapter.healthCheck(target)
    log("healthCheck", result)
    expect(result.ok).toBe(true)
  })

  it("revokeClient — removes client certificate", async () => {
    skipIfNoCreds()
    await adapter.revokeClient(target, clientName)
    log("revokeClient", { clientName, status: "revoked" })
  })

  it("removeClient — cleans up .ovpn file", async () => {
    skipIfNoCreds()
    await adapter.removeClient(target, clientName)
    log("removeClient", { clientName, status: "removed" })
  })

  it("restartServer — docker compose restart works", async () => {
    skipIfNoCreds()
    await adapter.restartServer(target)
    log("restartServer", { status: "restarted" })
  })

  it("validateClient — profile gone after removal", async () => {
    skipIfNoCreds()
    const result = await adapter.validateClient(target, clientName)
    log("validateClient (post-removal)", result)
    expect(result.exists).toBe(false)
  })
})
