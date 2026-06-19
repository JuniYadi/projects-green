import { beforeEach, describe, expect, it, mock } from "bun:test"

import { decryptVpnConfig, resetVpnCrypto } from "./vpn-crypto"
import { VpnClientService } from "./vpn-client.service"

const VALID_ENCRYPTION_KEY = Buffer.alloc(32).fill("e").toString("hex")

const mockPrisma = {
  vpnClient: {
    create: mock(),
    findFirst: mock(),
    findMany: mock(),
    update: mock(),
  },
}

const service = new VpnClientService(mockPrisma)

beforeEach(() => {
  process.env.ENCRYPTION_KEY = VALID_ENCRYPTION_KEY
  resetVpnCrypto()
  mockPrisma.vpnClient.create.mockReset()
  mockPrisma.vpnClient.findFirst.mockReset()
  mockPrisma.vpnClient.update.mockReset()
})

describe("VpnClientService", () => {
  it("stores encrypted ovpn config for an active OpenVPN Indonesia client", async () => {
    mockPrisma.vpnClient.create.mockImplementation(async ({ data }) => ({
      id: "vpn_client_1",
      ...data,
    }))

    const client = await service.createActiveClient({
      organizationId: "org_1",
      subscriptionId: "sub_1",
      clientName: "org_org1_sub_1",
      currentPeriodStart: new Date("2026-06-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-07-01T00:00:00.000Z"),
      createdBy: "user_1",
      ovpnConfig: "client\nsecret-cert\n",
    })

    expect(client.status).toBe("ACTIVE")
    expect(client.provider).toBe("OPENVPN")
    expect(client.regionCode).toBe("INDONESIA")
    expect(client.encryptedConfig).not.toBe("client\nsecret-cert\n")
    expect(decryptVpnConfig(client.encryptedConfig!)).toBe(
      "client\nsecret-cert\n"
    )
    expect(mockPrisma.vpnClient.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org_1",
        subscriptionId: "sub_1",
        provider: "OPENVPN",
        regionCode: "INDONESIA",
        clientName: "org_org1_sub_1",
        status: "ACTIVE",
        createdBy: "user_1",
      }),
    })
  })

  it("records provisioning failure without storing raw config", async () => {
    mockPrisma.vpnClient.create.mockImplementation(async ({ data }) => ({
      id: "vpn_client_failed",
      ...data,
    }))

    const client = await service.createProvisioningFailure({
      organizationId: "org_1",
      subscriptionId: "sub_1",
      clientName: "org_org1_sub_1",
      currentPeriodStart: new Date("2026-06-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-07-01T00:00:00.000Z"),
      createdBy: "user_1",
      reason: "adapter failed",
    })

    expect(client.status).toBe("PROVISIONING_FAILED")
    expect(client.encryptedConfig).toBeNull()
    expect(client.metadataJson).toEqual({ failureReason: "adapter failed" })
  })

  it("downloads decrypted config only for the owning organization", async () => {
    const encryptedConfig = service.encryptConfigForTest("client\nsecret\n")
    mockPrisma.vpnClient.findFirst.mockResolvedValue({
      id: "vpn_client_1",
      organizationId: "org_1",
      status: "ACTIVE",
      encryptedConfig,
      clientName: "org_org1_sub_1",
    })

    const result = await service.getDownloadForOrganization({
      organizationId: "org_1",
      clientId: "vpn_client_1",
    })

    expect(result).toEqual({
      fileName: "org_org1_sub_1.ovpn",
      content: "client\nsecret\n",
    })
    expect(mockPrisma.vpnClient.findFirst).toHaveBeenCalledWith({
      where: {
        id: "vpn_client_1",
        organizationId: "org_1",
        status: "ACTIVE",
      },
    })
  })

  it("marks an organization-owned client as revoked", async () => {
    mockPrisma.vpnClient.findFirst.mockResolvedValue({
      id: "vpn_client_1",
      organizationId: "org_1",
      clientName: "org_org1_sub_1",
      status: "ACTIVE",
    })
    mockPrisma.vpnClient.update.mockImplementation(async ({ data }) => ({
      id: "vpn_client_1",
      ...data,
    }))

    const result = await service.markRevoked({
      organizationId: "org_1",
      clientId: "vpn_client_1",
    })

    expect(result.status).toBe("REVOKED")
    expect(result.revokedAt).toBeInstanceOf(Date)
    expect(mockPrisma.vpnClient.update).toHaveBeenCalledWith({
      where: { id: "vpn_client_1" },
      data: expect.objectContaining({ status: "REVOKED" }),
    })
  })
})
