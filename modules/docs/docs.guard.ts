import { prisma } from "@/lib/prisma"

export type SafetyCheckReason =
  | "PROFANITY"
  | "OVERSIZE"
  | "INJECTION"
  | "SPAM"
  | "IP_FLOOD"
  | "USER_RATE_LIMIT"

export type SafetyCheckResult = {
  ok: boolean
  reason?: SafetyCheckReason
  message?: string
}

export type RateLimitResult = {
  allowed: boolean
  retryAfterSec?: number
  reason?: "IP_FLOOD" | "USER_RATE_LIMIT"
}

export type ActiveBanInfo = {
  isBanned: boolean
  banType?: string
  offenseLevel?: number
  isPermanent?: boolean
  blockedUntil?: Date | null
  reason?: string | null
}

export const MAX_PROMPT_LENGTH = 5000
export const IP_RATE_LIMIT_MAX = 15
export const IP_RATE_LIMIT_WINDOW_MS = 60_000 // 60s
export const USER_RATE_LIMIT_MAX = 5
export const USER_RATE_LIMIT_WINDOW_MS = 30_000 // 30s

// Profanity regex patterns (Indonesian & English toxic/vulgar terms)
const PROFANITY_PATTERNS = [
  // Indonesian profanities, slurs & regional toxic terms (Jawa, Sunda, Batak, slang)
  /\b(asu|anjing|babi|bangsat|kontol|memek|pantek|itil|jembut|ngentot|perek|lonte|pepek|bajingan|kampret|peler|tetek|toket|bego|tolol|idiot|bodoh|goblok|setan|iblis|silit|pukimak|jancok|jancuk|dancok|cok|matamu|ndasmu|taek|telek|tempik|puki|kimak|pantat|tai)\b/i,
  // English profanities & slurs
  /\b(fuck|fucking|shit|bitch|asshole|cunt|dick|pussy|nigger|faggot|whore|slut|motherfucker|bastard|cock|blowjob)\b/i,
]

// Injection & Jailbreak patterns: Script injection, XSS, dangerous SQL manipulation, and LLM Prompt Injections / Jailbreaks
const INJECTION_PATTERNS = [
  /<\s*script\b[^>]*>/i,
  /javascript\s*:/i,
  /on(error|load|click|mouseover|submit)\s*=/i,
  /\b(union\s+select|select\s+.*\s+from|drop\s+table|insert\s+into|delete\s+from|update\s+.*\s+set)\b/i,
  /(\/\*|\*\/)/,
  // Prompt injection & jailbreak keywords
  /\b(ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)|disregard\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)|you\s+are\s+now\s+in\s+dan\s+mode|override\s+system\s+prompt|reveal\s+system\s+prompt|show\s+(me\s+)?(your\s+)?system\s+prompt|bypass\s+(all\s+)?security|abaikan\s+(semua\s+)?(instruksi|perintah|aturan)\s+(sebelumnya|di\s+atas))\b/i,
]
// In-memory sliding window rate limiter stores
type RateLimitEntry = {
  timestamps: number[]
}

// Process-local limiter state; production instances do not share these buckets.
const ipRateLimitStore = new Map<string, RateLimitEntry>()
const userRateLimitStore = new Map<string, RateLimitEntry>()
let lastRateLimitSweepAt = Number.NEGATIVE_INFINITY

function pruneRateLimitEntry(entry: RateLimitEntry, windowStart: number) {
  let writeIndex = 0

  for (const timestamp of entry.timestamps) {
    if (timestamp > windowStart) {
      entry.timestamps[writeIndex] = timestamp
      writeIndex += 1
    }
  }

  entry.timestamps.length = writeIndex
}

function pruneRateLimitStore(
  store: Map<string, RateLimitEntry>,
  windowMs: number,
  now: number
) {
  const windowStart = now - windowMs

  for (const [key, entry] of store) {
    pruneRateLimitEntry(entry, windowStart)
    if (entry.timestamps.length === 0) {
      store.delete(key)
    }
  }
}

function pruneExpiredRateLimitEntries(now: number) {
  if (now - lastRateLimitSweepAt < USER_RATE_LIMIT_WINDOW_MS) {
    return
  }

  pruneRateLimitStore(ipRateLimitStore, IP_RATE_LIMIT_WINDOW_MS, now)
  pruneRateLimitStore(userRateLimitStore, USER_RATE_LIMIT_WINDOW_MS, now)
  lastRateLimitSweepAt = now
}

/**
 * Resets in-memory rate limiters (primarily for testing)
 */
export function resetRateLimiterStores() {
  ipRateLimitStore.clear()
  userRateLimitStore.clear()
  lastRateLimitSweepAt = Number.NEGATIVE_INFINITY
}

/**
 * Validates prompt safety: length <= 800, no profanity, no script/SQL injection.
 */
export function inspectPromptSafety(
  text: string,
  customBlockedWords: string[] = []
): SafetyCheckResult {
  const trimmed = text.trim()

  // 1. Oversize Check
  if (trimmed.length > MAX_PROMPT_LENGTH) {
    return {
      ok: false,
      reason: "OVERSIZE",
      message: `Prompt exceeds maximum character limit of ${MAX_PROMPT_LENGTH} characters.`,
    }
  }

  // 2. Custom Blocked Words Check
  for (const word of customBlockedWords) {
    if (word.trim()) {
      const regex = new RegExp(`\\b${escapeRegExp(word.trim())}\\b`, "i")
      if (regex.test(trimmed)) {
        return {
          ok: false,
          reason: "PROFANITY",
          message: "Prompt contains prohibited vocabulary.",
        }
      }
    }
  }

  // 3. Built-in Profanity Check
  for (const pattern of PROFANITY_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        ok: false,
        reason: "PROFANITY",
        message: "Prompt contains prohibited profanity or toxic language.",
      }
    }
  }

  // 4. Script & Injection Check
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        ok: false,
        reason: "INJECTION",
        message:
          "Prompt contains disallowed script, HTML, or injection patterns.",
      }
    }
  }

  return { ok: true }
}

/**
 * In-memory sliding window rate limiter for IP and User ID.
 */
export function checkRateLimit(
  ipAddress?: string | null,
  userId?: string | null,
  now: number = Date.now()
): RateLimitResult {
  pruneExpiredRateLimitEntries(now)
  // Check IP rate limit (15 requests per 60s)
  if (ipAddress) {
    const ipEntry = ipRateLimitStore.get(ipAddress) || { timestamps: [] }
    const windowStart = now - IP_RATE_LIMIT_WINDOW_MS
    pruneRateLimitEntry(ipEntry, windowStart)

    if (ipEntry.timestamps.length >= IP_RATE_LIMIT_MAX) {
      const oldest = ipEntry.timestamps[0]
      const retryAfterSec = Math.ceil(
        (oldest + IP_RATE_LIMIT_WINDOW_MS - now) / 1000
      )
      return {
        allowed: false,
        reason: "IP_FLOOD",
        retryAfterSec: Math.max(1, retryAfterSec),
      }
    }

    ipEntry.timestamps.push(now)
    ipRateLimitStore.set(ipAddress, ipEntry)
  }

  // Check User rate limit (5 requests per 30s)
  if (userId) {
    const userEntry = userRateLimitStore.get(userId) || { timestamps: [] }
    const windowStart = now - USER_RATE_LIMIT_WINDOW_MS
    pruneRateLimitEntry(userEntry, windowStart)

    if (userEntry.timestamps.length >= USER_RATE_LIMIT_MAX) {
      const oldest = userEntry.timestamps[0]
      const retryAfterSec = Math.ceil(
        (oldest + USER_RATE_LIMIT_WINDOW_MS - now) / 1000
      )
      return {
        allowed: false,
        reason: "USER_RATE_LIMIT",
        retryAfterSec: Math.max(1, retryAfterSec),
      }
    }

    userEntry.timestamps.push(now)
    userRateLimitStore.set(userId, userEntry)
  }

  return { allowed: true }
}

/**
 * Checks if the target IP, User ID, Organization ID, or Customer Phone is currently banned.
 */
export async function checkActiveBan(params: {
  ipAddress?: string | null
  userId?: string | null
  organizationId?: string | null
  customerPhone?: string | null
}): Promise<ActiveBanInfo> {
  const targets: Array<{ banType: string; targetValue: string }> = []

  if (params.organizationId) {
    targets.push({
      banType: "ORGANIZATION",
      targetValue: params.organizationId,
    })
  }
  if (params.userId) {
    targets.push({ banType: "USER", targetValue: params.userId })
  }
  if (params.ipAddress) {
    targets.push({ banType: "IP", targetValue: params.ipAddress })
  }
  if (params.customerPhone) {
    targets.push({ banType: "PHONE", targetValue: params.customerPhone })
  }

  if (targets.length === 0) {
    return { isBanned: false }
  }
  const now = new Date()

  const activeBans = await prisma.aiChatBan.findMany({
    where: {
      pardonedAt: null,
      OR: targets.map((target) => ({
        banType: target.banType,
        targetValue: target.targetValue,
      })),
      AND: [
        {
          OR: [{ isPermanent: true }, { blockedUntil: { gt: now } }],
        },
      ],
    },
    orderBy: [{ isPermanent: "desc" }, { offenseLevel: "desc" }],
    take: 1,
  })

  if (activeBans.length > 0) {
    const ban = activeBans[0]
    return {
      isBanned: true,
      banType: ban.banType,
      offenseLevel: ban.offenseLevel,
      isPermanent: ban.isPermanent,
      blockedUntil: ban.blockedUntil,
      reason: ban.reason,
    }
  }

  return { isBanned: false }
}

/**
 * Strike escalation thresholds (over last 7 days):
 * 3 strikes  -> Level 1 (1 Hour block)
 * 5 strikes  -> Level 2 (12 Hours block)
 * 8 strikes  -> Level 3 (24 Hours block)
 * 12 strikes -> Level 4 (7 Days block)
 * 15 strikes -> Level 5 (Permanent Ban)
 */
export function getEscalationLevel(totalStrikes: number): {
  offenseLevel: number
  durationMs: number
  isPermanent: boolean
} {
  if (totalStrikes >= 15) {
    return { offenseLevel: 5, durationMs: 0, isPermanent: true }
  }
  if (totalStrikes >= 12) {
    return {
      offenseLevel: 4,
      durationMs: 7 * 24 * 60 * 60 * 1000, // 7 Days
      isPermanent: false,
    }
  }
  if (totalStrikes >= 8) {
    return {
      offenseLevel: 3,
      durationMs: 24 * 60 * 60 * 1000, // 24 Hours
      isPermanent: false,
    }
  }
  if (totalStrikes >= 5) {
    return {
      offenseLevel: 2,
      durationMs: 12 * 60 * 60 * 1000, // 12 Hours
      isPermanent: false,
    }
  }
  if (totalStrikes >= 3) {
    return {
      offenseLevel: 1,
      durationMs: 60 * 60 * 1000, // 1 Hour
      isPermanent: false,
    }
  }

  return { offenseLevel: 0, durationMs: 0, isPermanent: false }
}

/**
 * Records a strike for a session and evaluates cumulative strikes across the organization / target to escalate bans.
 */
export async function recordStrikeAndEscalate(params: {
  sessionId: string
  organizationId?: string | null
  userId?: string | null
  ipAddress?: string | null
  customerPhone?: string | null
  reason: string
}): Promise<ActiveBanInfo> {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  // 1. Increment strike count on the session
  await prisma.aiChatSession.updateMany({
    where: { sessionId: params.sessionId },
    data: {
      strikeCount: { increment: 1 },
      isBlocked: true,
      blockReason: params.reason,
    },
  })

  // 2. Count total strikes from sessions in org / user / IP over last 7 days
  const sessionFilter: Array<{
    organizationId?: string
    userId?: string
    ipAddress?: string
  }> = []
  if (params.organizationId) {
    sessionFilter.push({ organizationId: params.organizationId })
  }
  if (params.userId) {
    sessionFilter.push({ userId: params.userId })
  }
  if (params.ipAddress) {
    sessionFilter.push({ ipAddress: params.ipAddress })
  }

  const sessions = await prisma.aiChatSession.findMany({
    where: {
      updatedAt: { gte: sevenDaysAgo },
      OR: sessionFilter.length > 0 ? sessionFilter : undefined,
    },
    select: { strikeCount: true },
  })

  const totalCumulativeStrikes = sessions.reduce(
    (sum, s) => sum + (s.strikeCount || 0),
    0
  )
  const escalation = getEscalationLevel(totalCumulativeStrikes)

  if (escalation.offenseLevel > 0) {
    const blockedUntil = escalation.isPermanent
      ? null
      : new Date(now.getTime() + escalation.durationMs)
    const targetsToBan: Array<{
      banType: string
      targetValue: string
    }> = []

    if (params.userId) {
      targetsToBan.push({ banType: "USER", targetValue: params.userId })
    }
    if (params.organizationId) {
      targetsToBan.push({
        banType: "ORGANIZATION",
        targetValue: params.organizationId,
      })
    }
    if (params.ipAddress) {
      targetsToBan.push({ banType: "IP", targetValue: params.ipAddress })
    }
    if (params.customerPhone) {
      targetsToBan.push({ banType: "PHONE", targetValue: params.customerPhone })
    }

    let primaryBan: {
      banType: string
      offenseLevel: number
      isPermanent: boolean
      blockedUntil: Date | null
      reason: string
    } | null = null

    for (const target of targetsToBan) {
      const ban = await prisma.aiChatBan.create({
        data: {
          banType: target.banType,
          targetValue: target.targetValue,
          organizationId: params.organizationId,
          userId: params.userId,
          ipAddress: params.ipAddress,
          customerPhone: params.customerPhone,
          offenseLevel: escalation.offenseLevel,
          isPermanent: escalation.isPermanent,
          blockedUntil,
          reason: `Cumulative strikes escalated: ${totalCumulativeStrikes} strikes (${params.reason})`,
          strikeSnapshot: totalCumulativeStrikes,
        },
      })
      if (!primaryBan) {
        primaryBan = {
          isBanned: true,
          banType: ban.banType,
          offenseLevel: ban.offenseLevel,
          isPermanent: ban.isPermanent,
          blockedUntil: ban.blockedUntil,
          reason: ban.reason,
        }
      }
    }

    return (
      primaryBan || {
        isBanned: true,
        banType: "USER",
        offenseLevel: escalation.offenseLevel,
        isPermanent: escalation.isPermanent,
        blockedUntil,
        reason: `Cumulative strikes escalated: ${totalCumulativeStrikes} strikes (${params.reason})`,
      }
    )
  }
  return { isBanned: false }
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
