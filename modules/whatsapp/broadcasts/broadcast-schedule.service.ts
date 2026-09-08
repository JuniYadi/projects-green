import { prisma } from "@/lib/prisma"
import { getHourlyMessageLimit } from "@/modules/whatsapp/devices/devices.constants"
import { MessageCostService } from "@/modules/billing/message-cost.service"
import { WhatsappBillingCategory } from "@prisma/client"
import type {
  DeviceBroadcastCapacityDTO,
  BroadcastScheduleRecommendationDTO,
} from "./broadcast-schedule.dto"

export class BroadcastScheduleLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BroadcastScheduleLimitError"
  }
}

export async function getDeviceBroadcastCapacity(
  organizationId: string,
  deviceId: string,
  totalRecipients?: number,
  category?: WhatsappBillingCategory | null
): Promise<DeviceBroadcastCapacityDTO> {
  const [device, account, subscription] = await Promise.all([
    prisma.whatsappDevice.findFirst({
      where: { id: deviceId, organizationId },
      select: {
        dailyLimitMessage: true,
        quotaBaseOut: true,
        addonQuota: true,
      },
    }),
    typeof prisma.billingAccount?.findUnique === "function"
      ? prisma.billingAccount.findUnique({
          where: { organizationId },
          select: { balance: true, currency: true },
        })
      : null,
    typeof prisma.serviceSubscription?.findFirst === "function"
      ? prisma.serviceSubscription.findFirst({
          where: {
            organizationId,
            package: { code: "WHATSAPP" },
            status: "ACTIVE",
          },
          include: { plan: true },
        })
      : null,
  ])

  if (!device) {
    throw new BroadcastScheduleLimitError("Device not found")
  }

  const dailyLimit = device.dailyLimitMessage
  const hourlyLimit = getHourlyMessageLimit(dailyLimit)

  const now = new Date()
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )
  const hourStart = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours()
    )
  )

  const [dailyCount, hourlyCount] = await Promise.all([
    prisma.whatsappDailyCount.findUnique({
      where: {
        organizationId_date_whatsappDeviceId: {
          organizationId,
          date: today,
          whatsappDeviceId: deviceId,
        },
      },
      select: { messageOutboxCount: true },
    }),
    prisma.whatsappHourlyCount.findUnique({
      where: {
        organizationId_whatsappDeviceId_hour: {
          organizationId,
          whatsappDeviceId: deviceId,
          hour: hourStart,
        },
      },
      select: { messageOutboxCount: true },
    }),
  ])

  const dailyUsed = dailyCount?.messageOutboxCount ?? 0
  const hourlyUsed = hourlyCount?.messageOutboxCount ?? 0

  const planResources = subscription?.plan?.resources as Record<
    string,
    unknown
  > | null
  const isUnlimited = planResources?.unlimited === true

  let unitPrice = 0
  let pricingCurrency: string | null = null
  if (!isUnlimited) {
    try {
      const messageCostService = new MessageCostService(prisma)
      const pricing = await messageCostService.getMessagePricing({
        organizationId,
        messageType: "template",
        deviceId,
        category: category ?? WhatsappBillingCategory.MARKETING,
      })
      if (pricing.unitPrice) {
        unitPrice = Number(pricing.unitPrice)
      }
      pricingCurrency = pricing.currency ?? null
    } catch {
      unitPrice = 0
    }
  }

  const quotaBaseOut = Number(device.quotaBaseOut ?? 0)
  const addonQuota = Number(device.addonQuota ?? 0)
  const quotaRemaining = Math.max(0, quotaBaseOut) + Math.max(0, addonQuota)
  const depositBalance = Number(account?.balance ?? 0)
  const currency = account?.currency ?? pricingCurrency ?? "IDR"

  const recipientsCount = totalRecipients ?? 0
  const coveredByQuota = Math.min(recipientsCount, quotaRemaining)
  const overageRecipients = Math.max(0, recipientsCount - quotaRemaining)
  const estimatedOverageCost = overageRecipients * unitPrice

  const maxFromBalance =
    unitPrice > 0
      ? Math.floor(depositBalance / unitPrice)
      : isUnlimited
        ? 999999
        : 0
  const maxAffordableRecipients = isUnlimited
    ? 999999
    : quotaRemaining + maxFromBalance

  const isAffordable = isUnlimited || recipientsCount <= maxAffordableRecipients

  return {
    dailyLimit,
    dailyUsed,
    hourlyLimit,
    hourlyUsed,
    remainingToday: Math.max(0, dailyLimit - dailyUsed),
    remainingThisHour: Math.max(0, hourlyLimit - hourlyUsed),
    quotaRemaining,
    depositBalance,
    unitPrice,
    currency,
    coveredByQuota,
    overageRecipients,
    estimatedOverageCost,
    maxAffordableRecipients,
    isAffordable,
    isUnlimited,
  }
}

export async function computeRecommendedSchedule(params: {
  totalRecipients: number
  organizationId: string
  deviceId: string
}): Promise<BroadcastScheduleRecommendationDTO> {
  const device = await prisma.whatsappDevice.findFirst({
    where: { id: params.deviceId, organizationId: params.organizationId },
    select: { dailyLimitMessage: true },
  })

  if (!device) {
    throw new BroadcastScheduleLimitError("Device not found")
  }

  const dailyLimit = device.dailyLimitMessage
  const hourlyLimit = getHourlyMessageLimit(dailyLimit)
  const throttleMaxMessages = Math.min(hourlyLimit, params.totalRecipients)
  const throttlePerMinutes = 60
  const estimatedDurationMinutes = Math.ceil(
    params.totalRecipients / (throttleMaxMessages / throttlePerMinutes)
  )

  return { throttleMaxMessages, throttlePerMinutes, estimatedDurationMinutes }
}

export async function validateSchedule(params: {
  throttleMaxMessages: number
  throttlePerMinutes: number
  totalRecipients: number
  organizationId: string
  deviceId: string
  acknowledgeMultiDay?: boolean
}) {
  if (
    !Number.isFinite(params.throttleMaxMessages) ||
    !Number.isFinite(params.throttlePerMinutes) ||
    params.throttleMaxMessages <= 0 ||
    params.throttlePerMinutes <= 0
  ) {
    throw new BroadcastScheduleLimitError(
      "Throttle values must be greater than zero."
    )
  }

  const capacity = await getDeviceBroadcastCapacity(
    params.organizationId,
    params.deviceId
  )

  const effectiveHourlyRate =
    (params.throttleMaxMessages / params.throttlePerMinutes) * 60

  if (effectiveHourlyRate > capacity.hourlyLimit) {
    throw new BroadcastScheduleLimitError(
      `Throttle rate of ${Math.round(effectiveHourlyRate)}/hour exceeds device hourly limit of ${capacity.hourlyLimit}/hour`
    )
  }

  if (
    params.totalRecipients > capacity.remainingToday &&
    !params.acknowledgeMultiDay
  ) {
    throw new BroadcastScheduleLimitError(
      `Broadcast has ${params.totalRecipients} recipients but only ${capacity.remainingToday} remaining today. ` +
        "Acknowledge multi-day send to proceed."
    )
  }
}
