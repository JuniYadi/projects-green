import { prisma } from "@/lib/prisma"

export class InsufficientQuotaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InsufficientQuotaError"
  }
}

export type QuotaCheckResult = {
  hasQuota: boolean
  currentCount: number
  monthlyLimit: number
  remaining: number
}

export type QuotaService = {
  checkQuota(organizationId: string, deviceId?: string): Promise<QuotaCheckResult>
  deductQuota(organizationId: string, deviceId?: string): Promise<void>
  getMonthlyStats(organizationId: string, deviceId?: string): Promise<{ inCount: number; outCount: number }>
}

export const quotaService: QuotaService = {
  async checkQuota(organizationId: string, deviceId?: string) {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1

    const device = deviceId
      ? await prisma.whatsappDevice.findFirst({
          where: { id: deviceId, organizationId },
        })
      : await prisma.whatsappDevice.findFirst({
          where: { organizationId },
        })

    const monthlyLimit = device?.quotaBaseOut
      ? Number(device.quotaBaseOut)
      : 0

    const monthlyCount = await prisma.whatsappMonthlyCount.findFirst({
      where: {
        organizationId,
        year: currentYear,
        month: currentMonth,
        whatsappDeviceId: deviceId ?? null,
      },
    })

    const currentCount = monthlyCount?.messageOutboxCount ?? 0
    const isUnlimited = monthlyLimit === 0 && !!device
    const remaining = isUnlimited
      ? 999999
      : Math.max(0, monthlyLimit - currentCount)

    return {
      hasQuota: isUnlimited || (monthlyLimit > 0 && remaining > 0),
      currentCount,
      monthlyLimit,
      remaining,
    }
  },

  async deductQuota(organizationId: string, deviceId?: string) {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1

    await prisma.$transaction(async (tx) => {
      const device = deviceId
        ? await tx.whatsappDevice.findFirst({
            where: { id: deviceId, organizationId },
          })
        : await tx.whatsappDevice.findFirst({
            where: { organizationId },
          })

      if (!device) {
        throw new Error("WhatsApp device not found")
      }

      const monthlyLimit = Number(device.quotaBaseOut)

      // Find or create monthly count (avoid compound unique with null)
      let monthlyCount = await tx.whatsappMonthlyCount.findFirst({
        where: {
          organizationId,
          year: currentYear,
          month: currentMonth,
          ...(deviceId ? { whatsappDeviceId: deviceId } : { whatsappDeviceId: null }),
        },
      })

      if (monthlyCount) {
        // Increment existing count
        monthlyCount = await tx.whatsappMonthlyCount.update({
          where: { id: monthlyCount.id },
          data: { messageOutboxCount: { increment: 1 } },
        })
      } else {
        // Create new count
        monthlyCount = await tx.whatsappMonthlyCount.create({
          data: {
            organizationId,
            year: currentYear,
            month: currentMonth,
            messageOutboxCount: 1,
            whatsappDeviceId: deviceId,
          },
        })
      }

      // Check if quota exceeded
      if (monthlyLimit > 0 && monthlyCount.messageOutboxCount > monthlyLimit) {
        throw new InsufficientQuotaError(
          `Monthly quota exceeded. Limit: ${monthlyLimit}, Current: ${monthlyCount.messageOutboxCount}`
        )
      }
    })
  },

  async getMonthlyStats(organizationId: string, deviceId?: string) {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1

    const monthlyCount = await prisma.whatsappMonthlyCount.findFirst({
      where: {
        organizationId,
        year: currentYear,
        month: currentMonth,
        whatsappDeviceId: deviceId ?? null,
      },
    })

    return {
      inCount: monthlyCount?.messageInboxCount ?? 0,
      outCount: monthlyCount?.messageOutboxCount ?? 0,
    }
  },
}