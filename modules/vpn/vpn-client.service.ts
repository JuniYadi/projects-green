import type { Prisma, PrismaClient } from "@prisma/client"

import { decryptWithAppKey, encryptWithAppKey } from "@/lib/whatsapp/crypto"

type VpnClientDelegate = Pick<PrismaClient["vpnClient"], "create" | "findFirst" | "update">

type VpnClientPrisma = {
  vpnClient: VpnClientDelegate
}

type VpnClientRecord = Prisma.VpnClientGetPayload<{}>

type CreateClientInput = {
  organizationId: string
  subscriptionId: string
  clientName: string
  currentPeriodStart: Date
  currentPeriodEnd: Date
  createdBy?: string | null
}

type CreateActiveClientInput = CreateClientInput & {
  ovpnConfig: string
}

type CreateProvisioningFailureInput = CreateClientInput & {
  reason: string
}

type OrganizationClientInput = {
  organizationId: string
  clientId: string
}

export class VpnClientNotFoundError extends Error {
  constructor() {
    super("VPN client not found")
    this.name = "VpnClientNotFoundError"
  }
}

export class VpnClientConfigUnavailableError extends Error {
  constructor() {
    super("VPN client config is unavailable")
    this.name = "VpnClientConfigUnavailableError"
  }
}

export class VpnClientService {
  constructor(private readonly prisma: VpnClientPrisma) {}

  async createActiveClient(
    input: CreateActiveClientInput,
  ): Promise<VpnClientRecord> {
    const encryptedConfig = await encryptWithAppKey(input.ovpnConfig)

    return this.prisma.vpnClient.create({
      data: {
        organizationId: input.organizationId,
        subscriptionId: input.subscriptionId,
        provider: "OPENVPN",
        regionCode: "INDONESIA",
        clientName: input.clientName,
        status: "ACTIVE",
        currentPeriodStart: input.currentPeriodStart,
        currentPeriodEnd: input.currentPeriodEnd,
        encryptedConfig,
        createdBy: input.createdBy ?? null,
      },
    })
  }

  async createProvisioningFailure(
    input: CreateProvisioningFailureInput,
  ): Promise<VpnClientRecord> {
    return this.prisma.vpnClient.create({
      data: {
        organizationId: input.organizationId,
        subscriptionId: input.subscriptionId,
        provider: "OPENVPN",
        regionCode: "INDONESIA",
        clientName: input.clientName,
        status: "PROVISIONING_FAILED",
        currentPeriodStart: input.currentPeriodStart,
        currentPeriodEnd: input.currentPeriodEnd,
        encryptedConfig: null,
        createdBy: input.createdBy ?? null,
        metadataJson: { failureReason: input.reason },
      },
    })
  }

  async getDownloadForOrganization(input: OrganizationClientInput): Promise<{
    fileName: string
    content: string
  }> {
    const client = await this.prisma.vpnClient.findFirst({
      where: {
        id: input.clientId,
        organizationId: input.organizationId,
        status: "ACTIVE",
      },
    })

    if (!client) {
      throw new VpnClientNotFoundError()
    }
    if (!client.encryptedConfig) {
      throw new VpnClientConfigUnavailableError()
    }

    return {
      fileName: `${client.clientName}.ovpn`,
      content: await decryptWithAppKey(client.encryptedConfig),
    }
  }

  async markRevoked(input: OrganizationClientInput): Promise<VpnClientRecord> {
    const client = await this.prisma.vpnClient.findFirst({
      where: {
        id: input.clientId,
        organizationId: input.organizationId,
        status: "ACTIVE",
      },
    })

    if (!client) {
      throw new VpnClientNotFoundError()
    }

    return this.prisma.vpnClient.update({
      where: { id: client.id },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
      },
    })
  }

  async encryptConfigForTest(config: string): Promise<string> {
    return encryptWithAppKey(config)
  }
}
