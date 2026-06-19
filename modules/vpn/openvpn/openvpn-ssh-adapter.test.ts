import { describe, expect, it, mock } from "bun:test"

import {
  OpenVpnSshAdapter,
  sanitizeOpenVpnClientName,
} from "./openvpn-ssh-adapter"

const env = {
  host: "vpn.example.com",
  user: "vpnadmin",
  privateKeyPath: "/tmp/id_ed25519",
  createScript: "/usr/local/bin/create-openvpn-client",
  revokeScript: "/usr/local/bin/revoke-openvpn-client",
  configDirectory: "/etc/openvpn/clients",
  healthCommand: "systemctl is-active openvpn-server@server",
}

describe("sanitizeOpenVpnClientName", () => {
  it("allows deterministic org/subscription client names", () => {
    expect(sanitizeOpenVpnClientName("org_abc123_sub_456")).toBe(
      "org_abc123_sub_456"
    )
  })

  it("rejects shell metacharacters and path traversal", () => {
    expect(() => sanitizeOpenVpnClientName("org_1; rm -rf /")).toThrow(
      "Invalid OpenVPN client name"
    )
    expect(() => sanitizeOpenVpnClientName("../secret")).toThrow(
      "Invalid OpenVPN client name"
    )
  })
})

describe("OpenVpnSshAdapter", () => {
  it("composes create, fetch, revoke, and health as allowlisted argv", async () => {
    const run = mock(async () => ({ stdout: "ok", stderr: "", exitCode: 0 }))
    const adapter = new OpenVpnSshAdapter({ env, run })

    await adapter.createClient("org_abc123_sub_456")
    await adapter.fetchConfig("org_abc123_sub_456")
    await adapter.revokeClient("org_abc123_sub_456")
    await adapter.healthCheck()

    expect(run).toHaveBeenNthCalledWith(1, "ssh", [
      "-i",
      "/tmp/id_ed25519",
      "-o",
      "BatchMode=yes",
      "-o",
      "StrictHostKeyChecking=yes",
      "vpnadmin@vpn.example.com",
      "--",
      "/usr/local/bin/create-openvpn-client",
      "org_abc123_sub_456",
    ])
    expect(run).toHaveBeenNthCalledWith(2, "ssh", [
      "-i",
      "/tmp/id_ed25519",
      "-o",
      "BatchMode=yes",
      "-o",
      "StrictHostKeyChecking=yes",
      "vpnadmin@vpn.example.com",
      "--",
      "cat",
      "/etc/openvpn/clients/org_abc123_sub_456.ovpn",
    ])
    expect(run).toHaveBeenNthCalledWith(3, "ssh", [
      "-i",
      "/tmp/id_ed25519",
      "-o",
      "BatchMode=yes",
      "-o",
      "StrictHostKeyChecking=yes",
      "vpnadmin@vpn.example.com",
      "--",
      "/usr/local/bin/revoke-openvpn-client",
      "org_abc123_sub_456",
    ])
    expect(run).toHaveBeenNthCalledWith(4, "ssh", [
      "-i",
      "/tmp/id_ed25519",
      "-o",
      "BatchMode=yes",
      "-o",
      "StrictHostKeyChecking=yes",
      "vpnadmin@vpn.example.com",
      "--",
      "systemctl",
      "is-active",
      "openvpn-server@server",
    ])
  })

  it("does not execute commands when client name is unsafe", async () => {
    const run = mock(async () => ({ stdout: "", stderr: "", exitCode: 0 }))
    const adapter = new OpenVpnSshAdapter({ env, run })

    await expect(adapter.createClient("bad;name")).rejects.toThrow(
      "Invalid OpenVPN client name"
    )
    expect(run).not.toHaveBeenCalled()
  })
})
