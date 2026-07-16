export type DeviceBroadcastCapacityDTO = {
  dailyLimit: number
  dailyUsed: number
  hourlyLimit: number
  hourlyUsed: number
  remainingToday: number
  remainingThisHour: number
}

export type BroadcastScheduleRecommendationDTO = {
  throttleMaxMessages: number
  throttlePerMinutes: number
  estimatedDurationMinutes: number
}

export function toDeviceBroadcastCapacityDTO(
  capacity: DeviceBroadcastCapacityDTO
): DeviceBroadcastCapacityDTO {
  return { ...capacity }
}

export function toBroadcastScheduleRecommendationDTO(
  recommendation: BroadcastScheduleRecommendationDTO
): BroadcastScheduleRecommendationDTO {
  return { ...recommendation }
}
