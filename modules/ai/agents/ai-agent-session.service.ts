import { randomUUID } from "node:crypto"
import type { AiChatMessage, AiChatSession } from "@prisma/client"
import type { CoreMessage } from "ai"

import { prisma } from "@/lib/prisma"
import { redis } from "@/lib/redis"

export interface GetOrCreateSessionParams {
  sessionId: string
  organizationId?: string | null
  agentProfileId?: string | null
  channel?: string
  channelTargetId?: string | null
  userId?: string | null
  userEmail?: string | null
  customerPhone?: string | null
  externalUserId?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}

export async function getOrCreateSession(
  params: GetOrCreateSessionParams
): Promise<AiChatSession> {
  const existing = await prisma.aiChatSession.findUnique({
    where: { sessionId: params.sessionId },
  })
  if (existing) {
    return existing
  }

  return prisma.aiChatSession.create({
    data: {
      sessionId: params.sessionId,
      organizationId: params.organizationId,
      agentProfileId: params.agentProfileId,
      channel: params.channel ?? "CONSOLE",
      channelTargetId: params.channelTargetId,
      userId: params.userId,
      userEmail: params.userEmail,
      customerPhone: params.customerPhone,
      externalUserId: params.externalUserId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
  })
}

export async function acquireSessionLock(
  sessionId: string,
  ttlSeconds: number = 10
): Promise<string | null> {
  const token = randomUUID()
  const key = `lock:ai:session:${sessionId}`
  const result = await redis.set(key, token, "EX", ttlSeconds, "NX")
  return result === "OK" ? token : null
}

const RELEASE_LOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`

export async function releaseSessionLock(
  sessionId: string,
  token: string
): Promise<boolean> {
  const key = `lock:ai:session:${sessionId}`
  if (typeof redis.eval === "function") {
    const result = await redis.eval(RELEASE_LOCK_LUA, 1, key, token)
    return result === 1 || result === "1"
  }
  const currentToken = await redis.get(key)
  if (currentToken === token) {
    await redis.del(key)
    return true
  }
  return false
}

export async function getConversationHistory(
  sessionId: string,
  limit: number = 20
): Promise<CoreMessage[]> {
  const messages = await prisma.aiChatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  return messages.reverse().map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }))
}

export const DEFAULT_TOKEN_BUDGET_CHARS = 12000 // ~3,000 tokens

export function slidingWindowPruning(
  messages: CoreMessage[],
  maxChars: number = DEFAULT_TOKEN_BUDGET_CHARS
): CoreMessage[] {
  const getMessageLength = (msg: CoreMessage): number => {
    if (typeof msg.content === "string") {
      return msg.content.length
    }
    return JSON.stringify(msg.content).length
  }

  const getTotalLength = (msgs: CoreMessage[]): number =>
    msgs.reduce((total, msg) => total + getMessageLength(msg), 0)

  if (getTotalLength(messages) <= maxChars) {
    return messages
  }

  const window = [...messages]

  while (window.length > 0 && getTotalLength(window) > maxChars) {
    if (window[0]?.role === "assistant") {
      window.shift()
      continue
    }

    window.shift()
    if (window[0]?.role === "assistant") {
      window.shift()
    }
  }

  while (window.length > 0 && window[0]?.role === "assistant") {
    window.shift()
  }

  return window
}

export interface RecordMessageParams {
  sessionId: string
  role: "user" | "assistant"
  content: string
  promptTokens?: number
  responseTokens?: number
  modelName?: string
  routePath?: string
  citations?: string[]
  durationMs?: number
  isFlagged?: boolean
  flagReason?: string
}

export async function recordMessage(
  params: RecordMessageParams
): Promise<AiChatMessage> {
  const promptTokens = params.promptTokens ?? 0
  const responseTokens = params.responseTokens ?? 0
  const totalTokens = promptTokens + responseTokens

  const message = await prisma.aiChatMessage.create({
    data: {
      sessionId: params.sessionId,
      role: params.role,
      content: params.content,
      promptTokens,
      responseTokens,
      modelName: params.modelName,
      routePath: params.routePath,
      citations: params.citations ?? [],
      durationMs: params.durationMs,
      isFlagged: params.isFlagged ?? false,
      flagReason: params.flagReason,
    },
  })

  await prisma.aiChatSession.update({
    where: { sessionId: params.sessionId },
    data: {
      totalMessages: { increment: 1 },
      totalTokens: { increment: totalTokens },
    },
  })

  return message
}
