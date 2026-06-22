import { beforeEach, describe, expect, it, mock } from "bun:test"

import type { SshCommandResult, SshTarget } from "@/modules/vpn/provisioning/vpn-server-ssh-executor"
import { VpnServerSshExecutor } from "@/modules/vpn/provisioning/vpn-server-ssh-executor"

import {
  OpenVpnSshAdapter,
  sanitizeOpenVpnClientName,
} from "./openvpn-ssh-adapter"

const target: SshTarget = {
  host: "vpn.example.com",
  ipAddress: undefined,
  user: "vpnadmin",
  encryptedPrivateKey: "fake-encrypted-key",
}

const mockExecChecked = mock<
  (target: SshTarget, args: string[], label?: string) => Promise<SshCommandResult>
>()

const mockExecInternal = mock()

const mockExecutor = {
  execChecked: mockExecChecked,
  exec: mockExecInternal,
  execInternal: mockExecInternal,
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
  beforeEach(() => {
    mockExecChecked.mockClear()
    mockExecInternal.mockClear()
  })
  it("composes create, fetch, revoke, and health via executor", async () => {
    mockExecChecked.mockImplementation(async (_target: SshTarget, args: string[]) => {
      if (args[0] === "cat") return { stdout: "client config", stderr: "", exitCode: 0 }
      return { stdout: "ok", stderr: "", exitCode: 0 }
    })
    mockExecInternal.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 })

    const adapter = new OpenVpnSshAdapter({
      executor: mockExecutor as unknown as VpnServerSshExecutor,
    })

    await adapter.createClient(target, "org_abc123_sub_456")
    await adapter.fetchConfig(target, "org_abc123_sub_456")
    await adapter.revokeClient(target, "org_abc123_sub_456")
    await adapter.removeClient(target, "org_abc123_sub_456")
    await adapter.healthCheck(target)

    expect(mockExecChecked).toHaveBeenNthCalledWith(
      1, target,
      ["bash", "/root/genclient.sh", "org_abc123_sub_456"],
      "create OpenVPN client"
    )
    expect(mockExecChecked).toHaveBeenNthCalledWith(
      2, target,
      ["cat", "/root/openvpn/clients/org_abc123_sub_456.ovpn"],
      "fetch OpenVPN config"
    )
    expect(mockExecChecked).toHaveBeenNthCalledWith(
      3, target,
      ["bash", "/root/revoke.sh", "org_abc123_sub_456"],
      "revoke OpenVPN client"
    )
    expect(mockExecChecked).toHaveBeenNthCalledWith(
      4, target,
      ["bash", "/root/rmcert.sh", "org_abc123_sub_456"],
      "remove OpenVPN client certificate"
    )
    expect(mockExecChecked).toHaveBeenNthCalledWith(
      5, target,
      ["systemctl", "is-active", "openvpn-server@server"],
      "check OpenVPN health"
    )
  })

  it("lists OpenVPN users via root userlist script", async () => {
    mockExecChecked.mockResolvedValue({
      stdout: "User aktif sekarang (3): juniyadi, orgabc-123456, + server cert\n",
      stderr: "",
      exitCode: 0,
    })

    const adapter = new OpenVpnSshAdapter({
      executor: mockExecutor as unknown as VpnServerSshExecutor,
    })

    const users = await adapter.listClients(target)

    expect(mockExecChecked).toHaveBeenCalledWith(
      target,
      ["bash", "/root/userlist.sh"],
      "list OpenVPN users"
    )
    expect(users).toEqual([
      {
        clientName: "juniyadi",
        status: "ACTIVE",
        serial: null,
        expiresAt: null,
        ipAllocation: null,
      },
      {
        clientName: "orgabc-123456",
        status: "ACTIVE",
        serial: null,
        expiresAt: null,
        ipAllocation: null,
      },
    ])
  })

  it("parses table format with active and revoked sections", async () => {
    mockExecChecked.mockResolvedValue({
      stdout: [
        "=== ACTIVE USERS ===",
        "USERNAME             | SERIAL                             | EXPIRES             | IP",
        "OpenVPNServer        | AAAA                               | 27-06-02 03:01:22   | dynamic",
        "juniyadi             | BBBB                               | 28-09-04 03:33:17   | dynamic.pool",
        "orgt7xt0p0g-5fbe09   | CCCC                               | 28-09-24 12:49:35   | dynamic.pool",
        "=== REVOKED USERS ===",
        "  test-yi-v2 (59671FE5DB5E0CB8F50D3819CC962B6A)",
        "Total active: 2",
        "Total revoked: 1",
      ].join("\n"),
      stderr: "",
      exitCode: 0,
    })

    const adapter = new OpenVpnSshAdapter({
      executor: mockExecutor as unknown as VpnServerSshExecutor,
    })

    await expect(adapter.listClients(target)).resolves.toEqual([
      {
        clientName: "juniyadi",
        status: "ACTIVE",
        serial: "BBBB",
        expiresAt: "28-09-04 03:33:17",
        ipAllocation: "dynamic.pool",
      },
      {
        clientName: "orgt7xt0p0g-5fbe09",
        status: "ACTIVE",
        serial: "CCCC",
        expiresAt: "28-09-24 12:49:35",
        ipAllocation: "dynamic.pool",
      },
      {
        clientName: "test-yi-v2",
        status: "REVOKED",
        serial: "59671FE5DB5E0CB8F50D3819CC962B6A",
        expiresAt: null,
        ipAllocation: null,
      },
    ])
  })

  it("does not execute commands when client name is unsafe", async () => {
    const adapter = new OpenVpnSshAdapter({
      executor: mockExecutor as unknown as VpnServerSshExecutor,
    })

    await expect(adapter.createClient(target, "bad;name")).rejects.toThrow(
      "Invalid OpenVPN client name"
    )
    expect(mockExecChecked).not.toHaveBeenCalled()
  })

  it("verifies generated ovpn profile exists after creation", async () => {
    mockExecChecked.mockResolvedValue({ stdout: "ok", stderr: "", exitCode: 0 })
    mockExecInternal.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 })

    const adapter = new OpenVpnSshAdapter({
      executor: mockExecutor as unknown as VpnServerSshExecutor,
    })

    await adapter.createClient(target, "org_abc123_sub_456")

    expect(mockExecInternal).toHaveBeenCalledWith(target, [
      "test",
      "-f",
      "/root/openvpn/clients/org_abc123_sub_456.ovpn",
    ])
  })

  it("validates generated ovpn profile existence", async () => {
    mockExecInternal.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 })

    const adapter = new OpenVpnSshAdapter({
      executor: mockExecutor as unknown as VpnServerSshExecutor,
    })

    const result = await adapter.validateClient(target, "org_abc123_sub_456")

    expect(result.exists).toBe(true)
    expect(mockExecInternal).toHaveBeenCalledWith(target, [
      "test",
      "-f",
      "/root/openvpn/clients/org_abc123_sub_456.ovpn",
    ])
  })

  it("returns missing when ovpn profile is absent", async () => {
    mockExecInternal.mockResolvedValue({ stdout: "", stderr: "", exitCode: 1 })

    const adapter = new OpenVpnSshAdapter({
      executor: mockExecutor as unknown as VpnServerSshExecutor,
    })

    const result = await adapter.validateClient(target, "org_abc123_sub_456")

    expect(result.exists).toBe(false)
    expect(result.message).toContain("OpenVPN profile not found")
  })

  it("throws error when ovpn profile is not found after creation", async () => {
    mockExecChecked.mockResolvedValue({ stdout: "ok", stderr: "", exitCode: 0 })
    mockExecInternal.mockResolvedValue({ stdout: "", stderr: "", exitCode: 1 })

    const adapter = new OpenVpnSshAdapter({
      executor: mockExecutor as unknown as VpnServerSshExecutor,
    })

    await expect(adapter.createClient(target, "org_abc123_sub_456")).rejects.toThrow(
      "OpenVPN profile not found"
    )
  })
})
