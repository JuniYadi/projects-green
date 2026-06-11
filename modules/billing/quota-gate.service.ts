import { PrismaClient } from "@prisma/client"
import { Prisma } from "@prisma/client"
import {
  WhatsAppPlanResources,
  QuotaCheckResult,
  QuotaExceededError,
  DailyLimitExceededError,
  DeviceNotFoundError,
  SubscriptionNotFoundError,
} from "./types"

export class QuotaGateService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get WhatsApp subscription for an organization.
   * Finds active WHATSAPP subscription by organizationId.
   */
  private async getWhatsAppSubscription(organizationId: string): Promise<{
    subscription: {
      id: string
      organizationId: string
      status: string
      planId: string
    }
    servicePlan: {
      code: string
      resources: WhatsAppPlanResources
    }
  }> {
    const subscription = await this.prisma.serviceSubscription.findFirst({
      where: {
        organizationId,
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
        organizationId: subscription.organizationId,
        status: subscription.status,
        planId: subscription.planId,
      },
      servicePlan: {
        code: subscription.plan.code,
        resources: subscription.plan.resources as unknown as WhatsAppPlanResources,
      },
    }
  }

  /**
   * Resolve effective limit from resources, preferring new canonical names
   * with fallback to legacy names.
   */
  private resolveLimit(
    resources: WhatsAppPlanResources,
    direction: "IN" | "OUT",
  ): { monthlyLimit: number | null; dailyLimit: number | null } {
    const monthlyLimit =
      direction === "IN"
        ? resources.quotaIn
        : (resources.quotaOutMonthly ?? resources.quotaOut)
    const dailyLimit =
      resources.quotaOutPerDeviceDaily ?? resources.dailyPerDevice
    return { monthlyLimit, dailyLimit }
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

    // PGREEN-050: Skip quota checks for unlimited/enterprise plans
    if (resources.unlimited === true) {
      return {
        allowed: true,
        direction,
        monthlyLimit: null,
        monthlyUsed: 0,
        dailyLimit: null,
        dailyUsed: 0,
        planCode: servicePlan.code,
        planResources: resources,
      }
    }

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

    const { monthlyLimit, dailyLimit } = this.resolveLimit(resources, direction)

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

      // PGREEN-050: Skip quota checks for unlimited/enterprise plans
      if (resources.unlimited === true) {
        return {
          allowed: true,
          direction,
          monthlyLimit: null,
          monthlyUsed: 0,
          dailyLimit: null,
          dailyUsed: 0,
          planCode: servicePlan.code,
          planResources: resources,
        }
      }

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

      // Monthly counts should NOT fall back to daily counts.
      const monthlyUsed =
        direction === "IN"
          ? monthlyCount?.messageInboxCount ?? 0
          : monthlyCount?.messageOutboxCount ?? 0

      const { monthlyLimit, dailyLimit } = this.resolveLimit(resources, direction)

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
   * Upsert daily message count within a transaction using Prisma upsert.
   * Atomically creates or increments the count without race conditions.
   */
  private async upsertDailyCount(
    tx: Prisma.TransactionClient,
    organizationId: string,
    deviceId: string,
    date: Date,
    direction: "IN" | "OUT",
  ): Promise<void> {
    const inboxCount = direction === "IN" ? 1 : 0
    const outboxCount = direction === "OUT" ? 1 : 0

    await tx.whatsappDailyCount.upsert({
      where: {
        organizationId_date_whatsappDeviceId: {
          organizationId,
          date,
          whatsappDeviceId: deviceId,
        },
      },
      create: {
        organizationId,
        date,
        whatsappDeviceId: deviceId,
        messageInboxCount: inboxCount,
        messageOutboxCount: outboxCount,
      },
      update: {
        messageInboxCount: { increment: inboxCount },
        messageOutboxCount: { increment: outboxCount },
      },
    })
  }

  /**
   * Upsert monthly message count within a transaction using Prisma upsert.
   * Atomically creates or increments the count without race conditions.
   */
  private async upsertMonthlyCount(
    tx: Prisma.TransactionClient,
    organizationId: string,
    deviceId: string,
    year: number,
    month: number,
    direction: "IN" | "OUT",
  ): Promise<void> {
    const inboxCount = direction === "IN" ? 1 : 0
    const outboxCount = direction === "OUT" ? 1 : 0

    await tx.whatsappMonthlyCount.upsert({
      where: {
        organizationId_year_month_whatsappDeviceId: {
          organizationId,
          year,
          month,
          whatsappDeviceId: deviceId,
        },
      },
      create: {
        organizationId,
        year,
        month,
        whatsappDeviceId: deviceId,
        messageInboxCount: inboxCount,
        messageOutboxCount: outboxCount,
      },
      update: {
        messageInboxCount: { increment: inboxCount },
        messageOutboxCount: { increment: outboxCount },
      },
    })
  }

  /**
   * Get quota status for all devices or a specific device in an organization.
   * Batch-fetches all daily and monthly counts to avoid N+1 queries.
   */
  async getQuotaStatus(
    organizationId: string,
    deviceId?: string,
  ): Promise<QuotaCheckResult[]> {
    const { servicePlan } = await this.getWhatsAppSubscription(organizationId)
    const resources = servicePlan.resources

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

    const now = new Date()
    const year = now.getUTCFullYear()
    const month = now.getUTCMonth() + 1
    const dateStr = now.toISOString().split("T")[0]

    // Batch fetch all daily counts
    const dailyCounts = await this.prisma.whatsappDailyCount.findMany({
      where: {
        organizationId,
        date: new Date(dateStr),
        whatsappDeviceId: { in: devices.map((d) => d.id) },
      },
    })

    // Batch fetch all monthly counts
    const monthlyCounts = await this.prisma.whatsappMonthlyCount.findMany({
      where: {
        organizationId,
        year,
        month,
        whatsappDeviceId: { in: devices.map((d) => d.id) },
      },
    })

    const dailyMap = new Map(dailyCounts.map((d) => [d.whatsappDeviceId, d]))
    const monthlyMap = new Map(monthlyCounts.map((m) => [m.whatsappDeviceId, m]))

    const results: QuotaCheckResult[] = []

    for (const device of devices) {
      const daily = dailyMap.get(device.id)
      const monthly = monthlyMap.get(device.id)

      for (const direction of ["IN", "OUT"] as const) {
        const dailyUsed =
          direction === "IN"
            ? daily?.messageInboxCount ?? 0
            : daily?.messageOutboxCount ?? 0
        const monthlyUsed =
          direction === "IN"
            ? monthly?.messageInboxCount ?? 0
            : monthly?.messageOutboxCount ?? 0

        const { monthlyLimit, dailyLimit } = this.resolveLimit(resources, direction)

        const allowed =
          resources.unlimited === true ||
          !(
            (dailyLimit !== null && dailyLimit !== 0 && dailyUsed >= dailyLimit) ||
            (monthlyLimit !== null && monthlyLimit !== 0 && monthlyUsed >= monthlyLimit)
          )

        results.push({
          allowed,
          direction,
          monthlyLimit,
          monthlyUsed,
          dailyLimit,
          dailyUsed,
          planCode: servicePlan.code,
          planResources: resources,
        })
      }
    }

    return results
  }
}
