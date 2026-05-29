import { PrismaClient } from "@prisma/client"
import { Prisma } from "@prisma/client"
import {
  WhatsAppPlanResources,
  QuotaCheckResult,
  QuotaExceededError,
  DailyLimitExceededError,
  DeviceNotFoundError,
  OrganizationNotMappedError,
  SubscriptionNotFoundError,
} from "./types"

export class QuotaGateService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get WhatsApp subscription for an organization.
   * Finds BillingAccount by organizationId to get tenantId, then finds active WHATSAPP subscription.
   */
  private async getWhatsAppSubscription(organizationId: string): Promise<{
    subscription: {
      id: string
      tenantId: string
      status: string
      planId: string
    }
    servicePlan: {
      code: string
      resources: WhatsAppPlanResources
    }
    tenantId: string
  }> {
    const billingAccount = await this.prisma.billingAccount.findUnique({
      where: { organizationId },
      select: { tenantId: true },
    })

    if (!billingAccount) {
      throw new OrganizationNotMappedError(organizationId)
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: {
        tenantId: billingAccount.tenantId,
        package: { code: "WHATSAPP" },
        status: "ACTIVE",
      },
      include: {
        plan: { select: { code: true, resources: true } },
      },
    })

    if (!subscription) {
      throw new SubscriptionNotFoundError(
        `No active WhatsApp subscription found for org=${organizationId}`,
      )
    }

    return {
      subscription: {
        id: subscription.id,
        tenantId: subscription.tenantId,
        status: subscription.status,
        planId: subscription.planId,
      },
      servicePlan: {
        code: subscription.plan.code,
        resources: subscription.plan.resources as unknown as WhatsAppPlanResources,
      },
      tenantId: subscription.tenantId,
    }
  }

  /**
   * Check if a message is allowed under current quota limits.
   */
  async checkMessageQuota(
    organizationId: string,
    deviceId: string,
    direction: "IN" | "OUT",
  ): Promise<QuotaCheckResult> {
    const { servicePlan } = await this.getWhatsAppSubscription(
      organizationId,
    )

    const resources = servicePlan.resources
    const now = new Date()
    const year = now.getUTCFullYear()
    const month = now.getUTCMonth() + 1
    const dateStr = now.toISOString().split("T")[0]

    // Validate device exists in org
    const device = await this.prisma.whatsappDevice.findFirst({
      where: { id: deviceId, organizationId },
      select: { id: true },
    })

    if (!device) {
      throw new DeviceNotFoundError(organizationId, deviceId)
    }

    // Get daily count
    const dailyCount = await this.prisma.whatsappDailyCount.findUnique({
      where: {
        organizationId_date_whatsappDeviceId: {
          organizationId,
          date: new Date(dateStr),
          whatsappDeviceId: deviceId,
        },
      },
    })

    // Get monthly count
    const monthlyCount = await this.prisma.whatsappMonthlyCount.findUnique({
      where: {
        organizationId_year_month_whatsappDeviceId: {
          organizationId,
          year,
          month,
          whatsappDeviceId: deviceId,
        },
      },
    })

    const dailyUsed =
      direction === "IN"
        ? dailyCount?.messageInboxCount ?? 0
        : dailyCount?.messageOutboxCount ?? 0

    const monthlyUsed =
      direction === "IN"
        ? monthlyCount?.messageInboxCount ?? 0
        : monthlyCount?.messageOutboxCount ?? 0

    const monthlyLimit =
      direction === "IN" ? resources.quotaIn : resources.quotaOut
    const dailyLimit = resources.dailyPerDevice

    // Check daily limit
    const dailyExceeded =
      dailyLimit !== null && dailyLimit !== 0 && dailyUsed >= dailyLimit

    // Check monthly limit
    const monthlyExceeded =
      monthlyLimit !== null && monthlyLimit !== 0 && monthlyUsed >= monthlyLimit

    const allowed = !dailyExceeded && !monthlyExceeded

    return {
      allowed,
      direction,
      monthlyLimit,
      monthlyUsed,
      dailyLimit,
      dailyUsed,
      planCode: servicePlan.code,
      planResources: resources,
    }
  }

  /**
   * Deduct a message quota after checking limits.
   * Uses transaction for check-then-increment to prevent race conditions.
   */
  async deductMessageQuota(
    organizationId: string,
    deviceId: string,
    direction: "IN" | "OUT",
  ): Promise<QuotaCheckResult> {
    return this.prisma.$transaction(async (tx) => {
      // Re-check quota within transaction
      const { servicePlan } = await this.getWhatsAppSubscription(organizationId)
      const resources = servicePlan.resources
      const now = new Date()
      const year = now.getUTCFullYear()
      const month = now.getUTCMonth() + 1
      const dateStr = now.toISOString().split("T")[0]
      const today = new Date(dateStr)

      // Validate device exists in org
      const device = await tx.whatsappDevice.findFirst({
        where: { id: deviceId, organizationId },
        select: { id: true },
      })

      if (!device) {
        throw new DeviceNotFoundError(organizationId, deviceId)
      }

      // Get daily count
      const dailyCount = await tx.whatsappDailyCount.findUnique({
        where: {
          organizationId_date_whatsappDeviceId: {
            organizationId,
            date: today,
            whatsappDeviceId: deviceId,
          },
        },
      })

      // Get monthly count
      const monthlyCount = await tx.whatsappMonthlyCount.findUnique({
        where: {
          organizationId_year_month_whatsappDeviceId: {
            organizationId,
            year,
            month,
            whatsappDeviceId: deviceId,
          },
        },
      })

      const dailyUsed =
        direction === "IN"
          ? dailyCount?.messageInboxCount ?? 0
          : dailyCount?.messageOutboxCount ?? 0

      const monthlyUsed =
        direction === "IN"
          ? monthlyCount?.messageInboxCount ?? 0
          : monthlyCount?.messageOutboxCount ?? dailyCount?.messageOutboxCount ??
            0

      const monthlyLimit =
        direction === "IN" ? resources.quotaIn : resources.quotaOut
      const dailyLimit = resources.dailyPerDevice

      const dailyExceeded =
        dailyLimit !== null && dailyLimit !== 0 && dailyUsed >= dailyLimit
      const monthlyExceeded =
        monthlyLimit !== null &&
        monthlyLimit !== 0 &&
        monthlyUsed >= monthlyLimit

      if (dailyExceeded) {
        throw new DailyLimitExceededError(
          organizationId,
          deviceId,
          dailyLimit,
          dailyUsed,
        )
      }

      if (monthlyExceeded) {
        throw new QuotaExceededError(
          organizationId,
          deviceId,
          direction,
          monthlyLimit,
          monthlyUsed,
        )
      }

      // Upsert daily count
      await this.upsertDailyCount(tx, organizationId, deviceId, today, direction)

      // Upsert monthly count
      await this.upsertMonthlyCount(tx, organizationId, deviceId, year, month, direction)

      return {
        allowed: true,
        direction,
        monthlyLimit,
        monthlyUsed: monthlyUsed + 1,
        dailyLimit,
        dailyUsed: dailyUsed + 1,
        planCode: servicePlan.code,
        planResources: resources,
      }
    })
  }

  /**
   * Upsert daily message count within a transaction.
   * Handles case where no rows exist yet.
   */
  private async upsertDailyCount(
    tx: Prisma.TransactionClient,
    organizationId: string,
    deviceId: string,
    date: Date,
    direction: "IN" | "OUT",
  ): Promise<void> {
    const fieldToIncrement =
      direction === "IN" ? "messageInboxCount" : "messageOutboxCount"

    try {
      const updated = await tx.whatsappDailyCount.updateMany({
        where: {
          organizationId,
          date,
          whatsappDeviceId: deviceId,
        },
        data: {
          [fieldToIncrement]: { increment: 1 },
        },
      })

      if (updated.count === 0) {
        // No existing record, create new one
        await tx.whatsappDailyCount.create({
          data: {
            organizationId,
            date,
            whatsappDeviceId: deviceId,
            messageInboxCount: direction === "IN" ? 1 : 0,
            messageOutboxCount: direction === "OUT" ? 1 : 0,
          },
        })
      }
    } catch (error) {
      // Handle race condition where another request created the record
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        const updated = await tx.whatsappDailyCount.updateMany({
          where: {
            organizationId,
            date,
            whatsappDeviceId: deviceId,
          },
          data: {
            [fieldToIncrement]: { increment: 1 },
          },
        })

        if (updated.count === 0) {
          await tx.whatsappDailyCount.create({
            data: {
              organizationId,
              date,
              whatsappDeviceId: deviceId,
              messageInboxCount: direction === "IN" ? 1 : 0,
              messageOutboxCount: direction === "OUT" ? 1 : 0,
            },
          })
        }
      } else {
        throw error
      }
    }
  }

  /**
   * Upsert monthly message count within a transaction.
   * Handles case where no rows exist yet.
   */
  private async upsertMonthlyCount(
    tx: Prisma.TransactionClient,
    organizationId: string,
    deviceId: string,
    year: number,
    month: number,
    direction: "IN" | "OUT",
  ): Promise<void> {
    const fieldToIncrement =
      direction === "IN" ? "messageInboxCount" : "messageOutboxCount"

    try {
      const updated = await tx.whatsappMonthlyCount.updateMany({
        where: {
          organizationId,
          year,
          month,
          whatsappDeviceId: deviceId,
        },
        data: {
          [fieldToIncrement]: { increment: 1 },
        },
      })

      if (updated.count === 0) {
        // No existing record, create new one
        await tx.whatsappMonthlyCount.create({
          data: {
            organizationId,
            year,
            month,
            whatsappDeviceId: deviceId,
            messageInboxCount: direction === "IN" ? 1 : 0,
            messageOutboxCount: direction === "OUT" ? 1 : 0,
          },
        })
      }
    } catch (error) {
      // Handle race condition where another request created the record
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        const updated = await tx.whatsappMonthlyCount.updateMany({
          where: {
            organizationId,
            year,
            month,
            whatsappDeviceId: deviceId,
          },
          data: {
            [fieldToIncrement]: { increment: 1 },
          },
        })

        if (updated.count === 0) {
          await tx.whatsappMonthlyCount.create({
            data: {
              organizationId,
              year,
              month,
              whatsappDeviceId: deviceId,
              messageInboxCount: direction === "IN" ? 1 : 0,
              messageOutboxCount: direction === "OUT" ? 1 : 0,
            },
          })
        }
      } else {
        throw error
      }
    }
  }

  /**
   * Get quota status for all devices or a specific device in an organization.
   */
  async getQuotaStatus(
    organizationId: string,
    deviceId?: string,
  ): Promise<QuotaCheckResult[]> {
    // Validate subscription exists
    await this.getWhatsAppSubscription(organizationId)

    const devices = await this.prisma.whatsappDevice.findMany({
      where: {
        organizationId,
        ...(deviceId ? { id: deviceId } : {}),
      },
      select: { id: true },
    })

    if (devices.length === 0 && deviceId) {
      throw new DeviceNotFoundError(organizationId, deviceId)
    }

    // Return status for both IN and OUT directions for each device
    const results: QuotaCheckResult[] = []

    for (const device of devices) {
      // Check IN direction
      const inResult = await this.checkMessageQuota(
        organizationId,
        device.id,
        "IN",
      )
      results.push(inResult)

      // Check OUT direction
      const outResult = await this.checkMessageQuota(
        organizationId,
        device.id,
        "OUT",
      )
      results.push(outResult)
    }

    return results
  }
}
