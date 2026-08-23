/**
 * Lightweight, robust cron expression matcher.
 * Supports standard 5-part cron syntax:
 *   minute (0-59)
 *   hour (0-23)
 *   day of month (1-31)
 *   month (1-12)
 *   day of week (0-7, 0 and 7 = Sunday)
 *
 * Supports *, lists (1,2,3), ranges (1-5), and steps (*\/5, 1-10/2).
 */

const matchField = (
  field: string,
  value: number,
  min: number,
  max: number
): boolean => {
  const trimmed = field.trim()
  if (trimmed === "*") {
    return true
  }

  // Handle comma-separated list: 1,2,3
  if (trimmed.includes(",")) {
    return trimmed.split(",").some((part) => matchField(part, value, min, max))
  }

  // Handle step: */5 or 1-10/2
  if (trimmed.includes("/")) {
    const [rangePart, stepPart] = trimmed.split("/")
    const step = Number.parseInt(stepPart, 10)
    if (Number.isNaN(step) || step <= 0) {
      return false
    }

    let rangeStart = min
    let rangeEnd = max

    if (rangePart !== "*") {
      if (rangePart.includes("-")) {
        const [startStr, endStr] = rangePart.split("-")
        rangeStart = Number.parseInt(startStr, 10)
        rangeEnd = Number.parseInt(endStr, 10)
      } else {
        rangeStart = Number.parseInt(rangePart, 10)
      }
    }

    if (value < rangeStart || value > rangeEnd) {
      return false
    }

    return (value - rangeStart) % step === 0
  }

  // Handle range: 1-5
  if (trimmed.includes("-")) {
    const [startStr, endStr] = trimmed.split("-")
    const start = Number.parseInt(startStr, 10)
    const end = Number.parseInt(endStr, 10)
    if (Number.isNaN(start) || Number.isNaN(end)) {
      return false
    }
    return value >= start && value <= end
  }

  // Single number
  const num = Number.parseInt(trimmed, 10)
  return num === value
}

export const cronMatches = (expression: string, date = new Date()): boolean => {
  const parts = expression.trim().split(/\s+/)
  if (parts.length !== 5) {
    throw new Error(
      `Invalid cron expression: "${expression}" (expected 5 fields)`
    )
  }

  const [minExpr, hourExpr, domExpr, monthExpr, dowExpr] = parts

  const minutes = date.getUTCMinutes()
  const hours = date.getUTCHours()
  const dom = date.getUTCDate()
  const month = date.getUTCMonth() + 1 // 1-12
  const dow = date.getUTCDay() // 0-6 (0 is Sunday)
  if (!matchField(minExpr, minutes, 0, 59)) return false
  if (!matchField(hourExpr, hours, 0, 23)) return false
  if (!matchField(domExpr, dom, 1, 31)) return false
  if (!matchField(monthExpr, month, 1, 12)) return false

  // For day of week, 7 also represents Sunday
  const dowMatched =
    matchField(dowExpr, dow, 0, 7) ||
    (dow === 0 && matchField(dowExpr, 7, 0, 7))
  if (!dowMatched) return false

  return true
}
