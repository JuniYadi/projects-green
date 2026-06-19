import { Prisma } from "@prisma/client"

const LOW_BALANCE_THRESHOLD_HOURS = 24

/**
 * Calculate estimated hours of runtime remaining based on balance and hourly cost.
 */
export function calculateHoursRemaining(
  balance: Prisma.Decimal,
  hourlyCost: Prisma.Decimal
): number {
  if (hourlyCost.lte(0)) return Infinity
  return balance.div(hourlyCost).floor().toNumber()
}

/**
 * Check if balance is at or below the low balance threshold.
 */
export function isLowBalance(
  balance: Prisma.Decimal,
  hourlyCost: Prisma.Decimal
): boolean {
  const hoursRemaining = calculateHoursRemaining(balance, hourlyCost)
  return hoursRemaining <= LOW_BALANCE_THRESHOLD_HOURS
}

/**
 * Get a user-friendly warning message for low balance.
 */
export function getLowBalanceMessage(
  balance: Prisma.Decimal,
  hourlyCost: Prisma.Decimal
): string | null {
  if (!isLowBalance(balance, hourlyCost)) return null

  const hoursRemaining = calculateHoursRemaining(balance, hourlyCost)
  if (hoursRemaining <= 0) {
    return "Your balance is depleted. Top up immediately to avoid suspension."
  }
  return `Your balance covers about ${hoursRemaining} hours. Top up to avoid suspension.`
}
