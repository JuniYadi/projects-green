import { describe, it, expect } from "bun:test"

import {
  toServerAccountDTO,
  computeProvisioningSummary,
  type VpnServerAccountDTO,
} from "./vpn-subscription.dto"

const baseAccount = {
  id: "sa-1",
  serverId: "srv-1",
  subscriptionId: "sub-1",
  protocol: "OPENVPN" as const,
  username: "org-test-abc123",
  provisioningStatus: "ACTIVE" as const,
  failureReason: null,
  configEncrypted: "encrypted-data",
  password: null,
  server: {
    id: "srv-1",
    name: "SG01",
    hostname: "sg01.vpn.com",
    ipAddress: "203.0.113.10",
    openVpnPort: 1194,
    wireGuardPort: 51820,
    proxyPort: 3128,
    region: {
      id: "reg-1",
      name: "Singapore",
      slug: "singapore",
      countryCode: "SG",
    },
  },
  createdAt: new Date("2026-06-01T00:00:00Z"),
  updatedAt: new Date("2026-06-01T00:00:00Z"),
}

describe("toServerAccountDTO", () => {
  it("maps OPENVPN to openVpnPort", () => {
    const result = toServerAccountDTO(baseAccount)
    expect(result.port).toBe(1194)
    expect(result.hostname).toBe("sg01.vpn.com")
    expect(result.ipAddress).toBe("203.0.113.10")
  })

  it("maps WIREGUARD to wireGuardPort", () => {
    const result = toServerAccountDTO({ ...baseAccount, protocol: "WIREGUARD" })
    expect(result.port).toBe(51820)
  })

  it("maps PROXY to proxyPort", () => {
    const result = toServerAccountDTO({ ...baseAccount, protocol: "PROXY" })
    expect(result.port).toBe(3128)
  })

  it("returns null port for unknown protocol", () => {
    const result = toServerAccountDTO({
      ...baseAccount,
      protocol: "UNKNOWN" as "OPENVPN" | "WIREGUARD" | "PROXY",
    } as Parameters<typeof toServerAccountDTO>[0])
    expect(result.port).toBeNull()
  })

  it("passes through region data", () => {
    const result = toServerAccountDTO(baseAccount)
    expect(result.region).toEqual({
      name: "Singapore",
      slug: "singapore",
      countryCode: "SG",
    })
  })

  it("handles missing region gracefully", () => {
    const result = toServerAccountDTO({
      ...baseAccount,
      server: {
        ...baseAccount.server,
        region: null as unknown as typeof baseAccount.server.region,
      },
    })
    expect(result.region).toBeNull()
  })

  it("handles null ipAddress", () => {
    const result = toServerAccountDTO({
      ...baseAccount,
      server: { ...baseAccount.server, ipAddress: null },
    })
    expect(result.ipAddress).toBeNull()
  })

  it("handles missing hostname/IP gracefully", () => {
    const result = toServerAccountDTO({
      ...baseAccount,
      server: {
        ...baseAccount.server,
        hostname: "",
        ipAddress: null,
      },
    })
    expect(result.hostname).toBe("")
    expect(result.ipAddress).toBeNull()
  })

  it("detects hasConfig from configEncrypted", () => {
    const withConfig = toServerAccountDTO(baseAccount)
    expect(withConfig.hasConfig).toBe(true)

    const withoutConfig = toServerAccountDTO({
      ...baseAccount,
      configEncrypted: null,
    })
    expect(withoutConfig.hasConfig).toBe(false)
  })

  it("detects hasCredentials from password", () => {
    const withCreds = toServerAccountDTO({
      ...baseAccount,
      password: "secret",
    })
    expect(withCreds.hasCredentials).toBe(true)

    const withoutCreds = toServerAccountDTO({
      ...baseAccount,
      password: null,
    })
    expect(withoutCreds.hasCredentials).toBe(false)
  })
})

describe("computeProvisioningSummary", () => {
  const account = (status: string) => ({
    id: "sa",
    serverId: "srv",
    serverName: "SG01",
    protocol: "OPENVPN" as const,
    username: "u",
    provisioningStatus: status as VpnServerAccountDTO["provisioningStatus"],
    failureReason: null,
    hasConfig: false,
    hasCredentials: false,
    hostname: "sg01.vpn.com",
    ipAddress: null,
    region: null,
    port: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  })

  it("counts ACTIVE correctly", () => {
    const summary = computeProvisioningSummary([
      account("ACTIVE"),
      account("FAILED"),
      account("ACTIVE"),
    ])
    expect(summary).toEqual({
      active: 2,
      pending: 0,
      failed: 1,
      revoked: 0,
      total: 3,
    })
  })

  it("counts PENDING and PROVISIONING as pending", () => {
    const summary = computeProvisioningSummary([
      account("PENDING"),
      account("PROVISIONING"),
      account("ACTIVE"),
    ])
    expect(summary.active).toBe(1)
    expect(summary.pending).toBe(2)
  })

  it("counts REVOKED correctly", () => {
    const summary = computeProvisioningSummary([
      account("REVOKED"),
      account("ACTIVE"),
    ])
    expect(summary).toEqual({
      active: 1,
      pending: 0,
      failed: 0,
      revoked: 1,
      total: 2,
    })
  })

  it("returns all-zero for empty array", () => {
    const summary = computeProvisioningSummary([])
    expect(summary).toEqual({
      active: 0,
      pending: 0,
      failed: 0,
      revoked: 0,
      total: 0,
    })
  })
})
