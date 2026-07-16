export const DEFAULT_DAILY_LIMIT_MESSAGE = 1000

export const getHourlyMessageLimit = (dailyLimit: number): number =>
  Math.max(1, Math.floor(dailyLimit / 24))
