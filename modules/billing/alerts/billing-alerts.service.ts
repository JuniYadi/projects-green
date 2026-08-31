import { prisma } from "@/lib/prisma"
import { redis } from "@/lib/redis"
import { type AlertVertical, type AlertEventType, Prisma } from "@prisma/client"

export type AlertRuleConfig = {
  isEnabled: boolean
  thresholdValue: number
  channels: string[]
  metadata?: Record<string, unknown> | null
}

export type VerticalAlertMap = Record<
  string, // targetId ("*" or specific ID)
  Partial<Record<AlertEventType, AlertRuleConfig>>
>

const CACHE_TTL_SECONDS = 86400 // 24 hours

export function getAlertCacheKey(
  organizationId: string,
  vertical: AlertVertical
): string {
  return `billing:alerts:${organizationId}:${vertical}`
}

/**
 * Fetch all alert rules for an organization and vertical, using Redis cache-aside.
 */
export async function getAlertRulesForVertical(
  organizationId: string,
  vertical: AlertVertical
): Promise<VerticalAlertMap> {
  const cacheKey = getAlertCacheKey(organizationId, vertical)

  try {
    const cached = await redis.get(cacheKey)
    if (cached) {
      return JSON.parse(cached) as VerticalAlertMap
    }
  } catch (err) {
    console.error("[billing-alerts] Redis get error:", err)
  }

  // Fallback to database
  const rules = await prisma.billingAlertRule.findMany({
    where: { organizationId, vertical },
  })

  const result: VerticalAlertMap = {}

  for (const rule of rules) {
    const target = rule.targetId || "*"
    if (!result[target]) {
      result[target] = {}
    }
    result[target]![rule.eventType] = {
      isEnabled: rule.isEnabled,
      thresholdValue: Number(rule.thresholdValue),
      channels: rule.channels,
      metadata: rule.metadata as Record<string, unknown> | null,
    }
  }

  try {
    await redis.set(cacheKey, JSON.stringify(result), "EX", CACHE_TTL_SECONDS)
  } catch (err) {
    console.error("[billing-alerts] Redis set error:", err)
  }

  return result
}

/**
 * Resolve effective rule for a specific target with fallback to global default ("*").
 */
export async function resolveAlertRule(
  organizationId: string,
  vertical: AlertVertical,
  eventType: AlertEventType,
  targetId: string = "*"
): Promise<AlertRuleConfig | null> {
  const map = await getAlertRulesForVertical(organizationId, vertical)

  // 1. Check target-specific override
  if (targetId !== "*" && map[targetId]?.[eventType]) {
    return map[targetId]![eventType]!
  }

  // 2. Check global org default ("*")
  if (map["*"]?.[eventType]) {
    return map["*"]![eventType]!
  }

  return null
}

export type UpsertAlertRuleInput = {
  organizationId: string
  vertical: AlertVertical
  eventType: AlertEventType
  targetId?: string
  isEnabled?: boolean
  thresholdValue?: number
  channels?: string[]
  metadata?: Record<string, unknown> | null
}

/**
 * Upsert an alert rule in DB and invalidate/update Redis cache.
 */
export async function upsertAlertRule(input: UpsertAlertRuleInput) {
  const targetId = input.targetId || "*"
  const thresholdValue =
    input.thresholdValue !== undefined
      ? new Prisma.Decimal(input.thresholdValue)
      : undefined

  const updated = await prisma.billingAlertRule.upsert({
    where: {
      organizationId_vertical_eventType_targetId: {
        organizationId: input.organizationId,
        vertical: input.vertical,
        eventType: input.eventType,
        targetId,
      },
    },
    create: {
      organizationId: input.organizationId,
      vertical: input.vertical,
      eventType: input.eventType,
      targetId,
      isEnabled: input.isEnabled ?? true,
      thresholdValue: thresholdValue ?? new Prisma.Decimal(80),
      channels: input.channels ?? ["EMAIL"],
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
    update: {
      ...(input.isEnabled !== undefined && { isEnabled: input.isEnabled }),
      ...(thresholdValue !== undefined && { thresholdValue }),
      ...(input.channels !== undefined && { channels: input.channels }),
      ...(input.metadata !== undefined && {
        metadata: input.metadata as Prisma.InputJsonValue,
      }),
    },
  })

  // Invalidate Redis cache
  const cacheKey = getAlertCacheKey(input.organizationId, input.vertical)
  try {
    await redis.del(cacheKey)
  } catch (err) {
    console.error("[billing-alerts] Redis del error:", err)
  }

  return updated
}

/**
 * Delete a specific alert rule (revert override).
 */
export async function deleteAlertRule(
  organizationId: string,
  vertical: AlertVertical,
  eventType: AlertEventType,
  targetId: string = "*"
) {
  await prisma.billingAlertRule.deleteMany({
    where: {
      organizationId,
      vertical,
      eventType,
      targetId,
    },
  })

  const cacheKey = getAlertCacheKey(organizationId, vertical)
  try {
    await redis.del(cacheKey)
  } catch (err) {
    console.error("[billing-alerts] Redis del error:", err)
  }
}
