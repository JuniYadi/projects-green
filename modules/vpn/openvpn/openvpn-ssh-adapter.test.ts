import { describe, expect, it, mock } from "bun:test"

import {
  OpenVpnSshAdapter,
  sanitizeOpenVpnClientName,
} from "./openvpn-ssh-adapter"

const target = {
  host: "vpn.example.com",
  user: "vpnadmin",
  encryptedPrivateKey: "fake-encrypted-key",
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
  it("composes create, fetch, revoke, and health via executor", async () => {
    const execChecked = mock(async (_target: unknown, args: string[]) => {
      if (args[0] === "cat") return { stdout: "client config", stderr: "", exitCode: 0 }
      return { stdout: "ok", stderr: "", exitCode: 0 }
    })

    const adapter = new OpenVpnSshAdapter({
      executor: { execChecked } as any,
    })

    await adapter.createClient(target, "org_abc123_sub_456")
    await adapter.fetchConfig(target, "org_abc123_sub_456")
    await adapter.revokeClient(target, "org_abc123_sub_456")
    await adapter.healthCheck(target)

    expect(execChecked).toHaveBeenNthCalledWith(
      1, target,
      ["/usr/local/bin/create-openvpn-client", "org_abc123_sub_456"],
      "create OpenVPN client"
    )
    expect(execChecked).toHaveBeenNthCalledWith(
      2, target,
      ["cat", "/etc/openvpn/clients/org_abc123_sub_456.ovpn"],
      "fetch OpenVPN config"
    )
    expect(execChecked).toHaveBeenNthCalledWith(
      3, target,
      ["/usr/local/bin/revoke-openvpn-client", "org_abc123_sub_456"],
      "revoke OpenVPN client"
    )
    expect(execChecked).toHaveBeenNthCalledWith(
      4, target,
      ["systemctl", "is-active", "openvpn-server@server"],
      "check OpenVPN health"
    )
  })

  it("does not execute commands when client name is unsafe", async () => {
    const execChecked = mock()
    const adapter = new OpenVpnSshAdapter({
      executor: { execChecked } as any,
    })

    await expect(adapter.createClient(target, "bad;name")).rejects.toThrow(
      "Invalid OpenVPN client name"
    )
    expect(execChecked).not.toHaveBeenCalled()
  })
})
