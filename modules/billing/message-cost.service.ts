import { PrismaClient } from "@prisma/client"
import { Prisma } from "@prisma/client"
import Decimal = Prisma.Decimal
import { BalanceGateService } from "./balance-gate.service"

export type MessageType = "text" | "template" | "media"

export class MessageCostService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Estimate the per-message cost for WhatsApp outbound messaging.
   *
   * Looks up the org's active WhatsApp subscription and its PAYG pricing
   * to determine the unit rate. Returns 0 if no subscription or no
   * pricing is found.
   */
  async estimateMessageCost(options: {
    organizationId: string
    messageType: MessageType
    deviceId?: string
  }): Promise<Decimal> {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        organizationId: options.organizationId,
        package: { code: "WHATSAPP" },
        status: "ACTIVE",
      },
      include: {
        plan: { select: { resources: true } },
      },
    })

    if (!subscription) {
      return new Decimal(0)
    }

    // Unlimited / enterprise plans have no per-message cost
    const resources = subscription.plan?.resources as Record<string, unknown> | undefined
    if (resources && resources.unlimited === true) {
      return new Decimal(0)
    }

    const balanceGate = new BalanceGateService(this.prisma)

    try {
      const pricing = await balanceGate.findPricing({
        planId: subscription.planId,
        regionId: "GLOBAL",
        type: "PAYG",
        billingMode: "PAYG",
      })

      const cost = pricing.unitRateMessage ?? new Decimal(0)

      return cost
    } catch {
      // No PAYG pricing found — rate is 0
      return new Decimal(0)
    }
  }

  /**
   * Convenience wrapper that checks whether the org has sufficient
   * balance to cover the estimated cost of one message.
   *
   * Returns { sufficient: true }  or
   *         { sufficient: false, required: Decimal, available: Decimal }
   */
  async checkBalanceForMessage(options: {
    organizationId: string
    messageType: MessageType
    deviceId?: string
  }): Promise<
    | { sufficient: true; required: Decimal; available: Decimal }
    | { sufficient: false; required: Decimal; available: Decimal }
  > {
    const estimatedCost = await this.estimateMessageCost(options)

    const account = await this.prisma.billingAccount.findUnique({
      where: { organizationId: options.organizationId },
      select: { balance: true },
    })

    if (!account) {
      return {
        sufficient: false,
        required: estimatedCost,
        available: new Decimal(0),
      }
    }

    const sufficient = account.balance.gte(estimatedCost)

    return {
      sufficient,
      required: estimatedCost,
      available: account.balance,
    }
  }
}
