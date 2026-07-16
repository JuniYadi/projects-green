import { prisma } from "@/lib/prisma"
import { getHourlyMessageLimit } from "@/modules/whatsapp/devices/devices.constants"
import type { DeviceBroadcastCapacityDTO, BroadcastScheduleRecommendationDTO } from "./broadcast-schedule.dto"

export class BroadcastScheduleLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BroadcastScheduleLimitError"
  }
}

export async function getDeviceBroadcastCapacity(
  organizationId: string,
  deviceId: string
): Promise<DeviceBroadcastCapacityDTO> {
  const device = await prisma.whatsappDevice.findFirst({
    where: { id: deviceId, organizationId },
    select: { dailyLimitMessage: true },
  })

  if (!device) {
    throw new BroadcastScheduleLimitError("Device not found")
  }

  const dailyLimit = device.dailyLimitMessage
  const hourlyLimit = getHourlyMessageLimit(dailyLimit)

  const now = new Date()
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const hourStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours()))

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

  return {
    dailyLimit,
    dailyUsed,
    hourlyLimit,
    hourlyUsed,
    remainingToday: Math.max(0, dailyLimit - dailyUsed),
    remainingThisHour: Math.max(0, hourlyLimit - hourlyUsed),
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
  const capacity = await getDeviceBroadcastCapacity(params.organizationId, params.deviceId)

  const effectiveHourlyRate = (params.throttleMaxMessages / params.throttlePerMinutes) * 60

  if (effectiveHourlyRate > capacity.hourlyLimit) {
    throw new BroadcastScheduleLimitError(
      `Throttle rate of ${Math.round(effectiveHourlyRate)}/hour exceeds device hourly limit of ${capacity.hourlyLimit}/hour`
    )
  }

  if (params.totalRecipients > capacity.remainingToday && !params.acknowledgeMultiDay) {
    throw new BroadcastScheduleLimitError(
      `Broadcast has ${params.totalRecipients} recipients but only ${capacity.remainingToday} remaining today. ` +
      "Acknowledge multi-day send to proceed."
    )
  }
}
