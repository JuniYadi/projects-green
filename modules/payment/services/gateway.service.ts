import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { EncryptionService } from "./encryption.service"
import type {
  DuitkuConfig,
  PaymentGatewayResponse,
} from "@/modules/payment/types/payment.types"

export class GatewayService {
  private encryption: EncryptionService

  constructor(encryption?: EncryptionService) {
    const key = process.env.ENCRYPTION_KEY || ""
    this.encryption = encryption || new EncryptionService(key)
  }

  async list(includeInactive = false): Promise<PaymentGatewayResponse[]> {
    const where = includeInactive ? {} : { isActive: true }
    const gateways = await prisma.paymentGateway.findMany({
      where,
      orderBy: [
        { isDefault: "desc" },
        { sortOrder: "asc" },
        { createdAt: "desc" },
      ],
    })

    return gateways.map((gw) => this.toResponse(gw))
  }

  async findById(id: string): Promise<PaymentGatewayResponse | null> {
    const gateway = await prisma.paymentGateway.findUnique({ where: { id } })
    if (!gateway) return null
    return this.toResponse(gateway)
  }

  async findByType(type: string): Promise<PaymentGatewayResponse | null> {
    const isDuitku = type.toLowerCase() === "duitku"
    const isGateway = type.toUpperCase() === "GATEWAY"

    const whereClause: Prisma.PaymentGatewayWhereInput =
      isDuitku || isGateway
        ? {
            isActive: true,
            OR: [
              { type: "duitku" },
              { type: "GATEWAY" },
              {
                name: { contains: "Duitku", mode: "insensitive" },
              },
            ],
          }
        : {
            isActive: true,
            type,
          }

    const gateway = await prisma.paymentGateway.findFirst({
      where: whereClause,
      orderBy: { isDefault: "desc" },
    })
    if (!gateway) return null
    return this.toResponse(gateway)
  }

  /**
   * List active gateways that can settle the given currency. A gateway with an
   * empty `supportedCurrencies` list is treated as currency-agnostic and is
   * always included (backwards compatible with rows created before this field
   * existed).
   */
  async listForCurrency(
    currency: string,
    options: { type?: string } = {}
  ): Promise<PaymentGatewayResponse[]> {
    const isDuitku = options.type?.toLowerCase() === "duitku"
    const isGateway = options.type?.toUpperCase() === "GATEWAY"

    const whereType: Prisma.PaymentGatewayWhereInput | undefined = options.type
      ? isDuitku || isGateway
        ? {
            OR: [
              { type: "duitku" },
              { type: "GATEWAY" },
              {
                name: { contains: "Duitku", mode: "insensitive" },
              },
            ],
          }
        : { type: options.type }
      : undefined

    const gateways = await prisma.paymentGateway.findMany({
      where: {
        isActive: true,
        ...whereType,
      },
      orderBy: [
        { isDefault: "desc" },
        { sortOrder: "asc" },
        { createdAt: "desc" },
      ],
    })

    return gateways
      .filter((gw) => {
        const supported = (gw.supportedCurrencies ?? []) as string[]
        return supported.length === 0 || supported.includes(currency)
      })
      .map((gw) => this.toResponse(gw))
  }

  /** First active gateway of `type` that can settle `currency`, if any. */
  async findByTypeForCurrency(
    type: string,
    currency: string
  ): Promise<PaymentGatewayResponse | null> {
    const gateways = await this.listForCurrency(currency, { type })
    return gateways[0] ?? null
  }

  async create(input: {
    name: string
    type: string
    config: DuitkuConfig
    isDefault?: boolean
    supportedCurrencies?: string[]
  }): Promise<PaymentGatewayResponse> {
    if (input.isDefault) {
      await prisma.paymentGateway.updateMany({
        where: { type: input.type, isDefault: true },
        data: { isDefault: false },
      })
    }

    const encryptedConfig = this.encryption.encryptField(
      JSON.stringify(input.config)
    )

    const gateway = await prisma.paymentGateway.create({
      data: {
        name: input.name,
        type: input.type,
        config: encryptedConfig,
        supportedCurrencies: input.supportedCurrencies ?? [],
        isDefault: input.isDefault || false,
        isActive: true,
      },
    })

    return this.toResponse(gateway)
  }

  async update(
    id: string,
    input: {
      name?: string
      type?: string
      config?: Record<string, string>
      isDefault?: boolean
      supportedCurrencies?: string[]
    }
  ): Promise<PaymentGatewayResponse> {
    const existing = await prisma.paymentGateway.findUnique({ where: { id } })
    if (!existing) throw new Error("Gateway not found")

    if (input.isDefault && !existing.isDefault) {
      await prisma.paymentGateway.updateMany({
        where: { type: existing.type, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      })
    }

    const data: Prisma.PaymentGatewayUpdateInput = {}
    if (input.name) data.name = input.name
    if (input.type) data.type = input.type
    if (input.config) {
      let currentConfig: Record<string, string> = {}
      try {
        currentConfig =
          ((await this.getDecryptedConfig(id)) as unknown as Record<
            string,
            string
          >) || {}
      } catch {
        currentConfig = {}
      }
      const mergedConfig = { ...currentConfig, ...input.config }
      data.config = this.encryption.encryptField(JSON.stringify(mergedConfig))
    }
    if (input.isDefault !== undefined) data.isDefault = input.isDefault
    if (input.supportedCurrencies !== undefined)
      data.supportedCurrencies = input.supportedCurrencies

    const gateway = await prisma.paymentGateway.update({
      where: { id },
      data,
    })

    return this.toResponse(gateway)
  }

  async toggle(id: string): Promise<PaymentGatewayResponse> {
    const gateway = await prisma.paymentGateway.findUnique({ where: { id } })
    if (!gateway) throw new Error("Gateway not found")

    const updated = await prisma.paymentGateway.update({
      where: { id },
      data: { isActive: !gateway.isActive },
    })

    return this.toResponse(updated)
  }

  async getDecryptedConfig(id: string): Promise<DuitkuConfig | null> {
    const gateway = await prisma.paymentGateway.findUnique({ where: { id } })
    if (!gateway) return null

    if (typeof gateway.config === "object" && gateway.config !== null) {
      return gateway.config as unknown as DuitkuConfig
    }
    try {
      const configStr = this.encryption.decryptField(gateway.config as string)
      return JSON.parse(configStr) as DuitkuConfig
    } catch {
      try {
        return JSON.parse(gateway.config as string) as DuitkuConfig
      } catch {
        return null
      }
    }
  }

  private toResponse(gateway: {
    id: string
    name: string
    type: string
    config: unknown
    supportedCurrencies: string[]
    isActive: boolean
    isDefault: boolean
  }): PaymentGatewayResponse {
    let rawConfig: Record<string, string> | null = null
    try {
      if (typeof gateway.config === "object" && gateway.config !== null) {
        rawConfig = gateway.config as Record<string, string>
      } else if (typeof gateway.config === "string") {
        const decrypted = this.encryption.decryptFieldOptional(gateway.config)
        if (decrypted) {
          rawConfig = JSON.parse(decrypted)
        }
      }
    } catch {
      rawConfig = null
    }

    const config: Record<string, string> = {
      ...(rawConfig || {
        sandboxUrl: "",
        productionUrl: "",
      }),
    }

    // Security: Always redact sensitive secrets in API responses!
    // Masked fields show as '***ENCRYPTED***' in the UI so passwords/secrets are never leaked over the wire.
    if (
      "apiKey" in config ||
      gateway.type === "GATEWAY" ||
      gateway.type === "duitku"
    ) {
      config.apiKey = "***ENCRYPTED***"
    }
    if ("clientSecret" in config || gateway.type === "paypal") {
      config.clientSecret = "***ENCRYPTED***"
    }

    return {
      id: gateway.id,
      name: gateway.name,
      type: gateway.type,
      supportedCurrencies: gateway.supportedCurrencies ?? [],
      isActive: gateway.isActive,
      isDefault: gateway.isDefault,
      config,
    }
  }
}
