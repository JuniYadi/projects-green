export type DeviceBroadcastCapacityDTO = {
  dailyLimit: number
  dailyUsed: number
  hourlyLimit: number
  hourlyUsed: number
  remainingToday: number
  remainingThisHour: number
  quotaRemaining?: number
  depositBalance?: number
  unitPrice?: number
  currency?: string
  coveredByQuota?: number
  overageRecipients?: number
  estimatedOverageCost?: number
  maxAffordableRecipients?: number
  isAffordable?: boolean
  isUnlimited?: boolean
}

export type BroadcastScheduleRecommendationDTO = {
  throttleMaxMessages: number
  throttlePerMinutes: number
  estimatedDurationMinutes: number
}

export function toDeviceBroadcastCapacityDTO(
  capacity: DeviceBroadcastCapacityDTO
): DeviceBroadcastCapacityDTO {
  return {
    dailyLimit: capacity.dailyLimit,
    dailyUsed: capacity.dailyUsed,
    hourlyLimit: capacity.hourlyLimit,
    hourlyUsed: capacity.hourlyUsed,
    remainingToday: capacity.remainingToday,
    remainingThisHour: capacity.remainingThisHour,
    ...(capacity.quotaRemaining !== undefined
      ? { quotaRemaining: capacity.quotaRemaining }
      : {}),
    ...(capacity.depositBalance !== undefined
      ? { depositBalance: capacity.depositBalance }
      : {}),
    ...(capacity.unitPrice !== undefined
      ? { unitPrice: capacity.unitPrice }
      : {}),
    ...(capacity.currency !== undefined ? { currency: capacity.currency } : {}),
    ...(capacity.coveredByQuota !== undefined
      ? { coveredByQuota: capacity.coveredByQuota }
      : {}),
    ...(capacity.overageRecipients !== undefined
      ? { overageRecipients: capacity.overageRecipients }
      : {}),
    ...(capacity.estimatedOverageCost !== undefined
      ? { estimatedOverageCost: capacity.estimatedOverageCost }
      : {}),
    ...(capacity.maxAffordableRecipients !== undefined
      ? { maxAffordableRecipients: capacity.maxAffordableRecipients }
      : {}),
    ...(capacity.isAffordable !== undefined
      ? { isAffordable: capacity.isAffordable }
      : {}),
    ...(capacity.isUnlimited !== undefined
      ? { isUnlimited: capacity.isUnlimited }
      : {}),
  }
}

export function toBroadcastScheduleRecommendationDTO(
  recommendation: BroadcastScheduleRecommendationDTO
): BroadcastScheduleRecommendationDTO {
  return { ...recommendation }
}
