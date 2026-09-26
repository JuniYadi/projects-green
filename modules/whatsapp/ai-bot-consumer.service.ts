import { generateText, stepCountIs, type ModelMessage } from "ai"

import { logger, logStageFailure } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import {
  acquireProcessingClaim,
  hasClaimMarker,
  markClaimDone,
  releaseProcessingClaim,
} from "@/lib/whatsapp/idempotency-repository"
import {
  getAiBotLockTtlSeconds,
  getAiBotTimeoutMs,
  isAiBotTimeoutError,
} from "@/modules/ai/ai-bot-timeout"
import {
  resolveAiProviderConfig,
  createAiLanguageModel,
} from "@/modules/ai/ai-provider.factory"
import { searchHybridKnowledge } from "@/modules/ai/ai-rag.service"
import { checkInboundAgentGuardrails } from "@/modules/ai/agents/ai-agent-inbound-guard"
import {
  inspectAgentPromptSafety,
  recordSafetyViolation,
} from "@/modules/ai/agents/ai-agent-guardrails"
import {
  acquireSessionLock,
  getSlidingWindowMessages,
  releaseSessionLock,
} from "@/modules/ai/agents/ai-agent-session.service"
import { buildAgentTools } from "@/modules/ai/agents/ai-agent-tools"
import { checkActiveBan } from "@/modules/docs/docs.guard"
import {
  buildInteractivePayload,
  parseInteractiveButtons,
} from "@/modules/whatsapp/ai/ai-interactive-parser"
import { messageService } from "@/modules/whatsapp/messages/messages.service"

export type ProcessAiBotInboundOptions = {
  organizationId: string
  deviceId: string
  contactPhone: string
  inboundMessageText: string
  conversationId: string
  inboundMessageId: string
  mediaUrl?: string
  mediaType?: string
}

export type ProcessAiBotInboundResult = {
  handled: boolean
  reason?: string
  responseMessageId?: string
  agentProfileId?: string
  tokensUsed?: number
}

const VISION_MODEL_PATTERNS = [
  /gpt-4o/i,
  /gpt-4-turbo/i,
  /claude-3/i,
  /claude-sonnet/i,
  /claude-opus/i,
  /gemini-1\.5/i,
  /gemini-2\.0/i,
]

/**
 * Checks whether an AI model name supports multimodal vision capabilities.
 */
export function isVisionSupportedModel(modelName: string): boolean {
  if (!modelName) return false
  return VISION_MODEL_PATTERNS.some((pattern) => pattern.test(modelName))
}

export const VISION_FALLBACK_TEXT =
  "Halo kak! Saat ini kami belum dapat mengenali gambar secara otomatis. " +
  "Boleh sebutkan nama produk atau kodenya? Atau klik tombol di bawah " +
  "untuk dibantu CS kami:"

/**
 * Generic Indonesian fallback shown when the model returns no usable text
 * and the agent has no `fallbackMessage` configured. The widget
 * (`widget-stream.route.ts`) and the simulator repeat this exact wording
 * (not imported, to keep them off this module's dependencies).
 */
export const GENERIC_AI_FALLBACK_MESSAGE =
  "Mohon maaf, kami belum dapat menjawab pertanyaan Anda saat ini."

const DAY_MS = 86_400_000

// Two-state reply claim (AC-01/AC-03). The "done" marker (24h TTL) means an
// outcome was already delivered for this wamid, so a BullMQ retry must
// return DUPLICATE_REPLY_CLAIMED instead of sending again. The "processing"
// claim covers a single in-flight attempt with a TTL derived from the AI
// timeout (+ buffer for surrounding I/O) — long enough for one attempt,
// short enough that a crashed process can't block a later retry forever.
const REPLY_DONE_TTL_SECONDS = 86_400
// ponytail: timeout + 60 s keeps a crashed attempt's claim shorter than the
// 60 s + 120 s webhook backoff, so the last BullMQ attempt can still run
const REPLY_PROCESSING_TTL_BUFFER_SECONDS = 60

const getReplyDoneKey = (inboundMessageId: string) =>
  `wa:bot-reply:done:${inboundMessageId}`

const getReplyProcessingKey = (inboundMessageId: string) =>
  `wa:bot-reply:processing:${inboundMessageId}`

/**
 * Attempts one best-effort fallback send after a stage has already failed
 * and been logged. A second failure here is itself logged but never
 * thrown, so a broken fallback send can't crash the caller a second time.
 */
async function sendBestEffortFallback(params: {
  organizationId: string
  phoneNumber: string
  deviceId: string
  replyToMessageId: string
  fallbackMessage: string | null | undefined
  agentProfileId: string
  sessionId?: string
  stage: string
}): Promise<boolean> {
  if (!params.fallbackMessage) {
    return true // nothing configured to deliver
  }
  try {
    await messageService.sendMessage({
      organizationId: params.organizationId,
      phoneNumber: params.phoneNumber,
      message: params.fallbackMessage,
      deviceId: params.deviceId,
      replyToMessageId: params.replyToMessageId,
    })
    return true
  } catch (fallbackError) {
    logStageFailure({
      agentProfileId: params.agentProfileId,
      sessionId: params.sessionId,
      channel: "WHATSAPP",
      stage: `${params.stage}_FALLBACK`,
      error: fallbackError,
    })
    return false
  }
}

/**
 * Thrown when no outcome reached the customer, so the processing claim is
 * released and BullMQ's retry of the same wamid tries again (AC-01).
 */
class FallbackNotDeliveredError extends Error {
  constructor(stage: string) {
    super(`AI bot fallback not delivered (stage=${stage})`)
    this.name = "FallbackNotDeliveredError"
  }
}

/**
 * Handles an inbound WhatsApp text message through the tenant's AI Agent
 * Profile (if bound and active).
 * Executes autonomous tool calling (RAG, tenant REST APIs, slot filling),
 * multi-turn thread memory with sliding window, and Redis concurrency lock.
 */
export async function processWhatsappAiBotInbound(
  options: ProcessAiBotInboundOptions
): Promise<ProcessAiBotInboundResult> {
  const {
    organizationId,
    deviceId,
    contactPhone,
    inboundMessageText,
    conversationId,
    inboundMessageId,
    mediaUrl,
    mediaType,
  } = options

  // 0. Silently drop messages from a banned customer (org-scoped, platform-
  // wide bans still apply). Runs before any other lookup so a banned
  // customer costs no extra query beyond the ban check itself.
  const banInfo = await checkActiveBan({
    organizationId,
    customerPhone: contactPhone,
  })
  if (banInfo.isBanned) {
    logger.warn(
      {
        event: "ai_bot.customer_banned",
        channel: "WHATSAPP",
        organizationId,
        customerPhone: contactPhone,
        banType: banInfo.banType,
        reason: banInfo.reason,
      },
      "AI bot dropped message from banned customer"
    )
    return { handled: true, reason: "CUSTOMER_BANNED" }
  }

  const trimmedText = inboundMessageText.trim()
  const isImage = Boolean(
    mediaUrl &&
    (!mediaType ||
      mediaType.startsWith("image") ||
      mediaType === "image" ||
      mediaUrl.includes("image"))
  )
  const isPdf = Boolean(
    mediaType === "application/pdf" ||
    mediaType === "pdf" ||
    (mediaUrl && mediaUrl.toLowerCase().endsWith(".pdf"))
  )

  let cleanText = trimmedText
  if (!cleanText) {
    if (isImage) {
      cleanText = "Tolong bantu analisis gambar ini kak."
    } else if (isPdf) {
      cleanText = "Tolong bantu periksa dokumen PDF ini kak."
    } else {
      return { handled: false, reason: "EMPTY_TEXT" }
    }
  }

  // 1. Check if device is bound to an active AI Agent Profile
  const binding = await prisma.aiChannelBinding.findFirst({
    where: {
      organizationId,
      channel: "WHATSAPP",
      targetId: deviceId,
      isActive: true,
    },
    include: {
      agentProfile: true,
    },
  })

  if (!binding || !binding.agentProfile || !binding.agentProfile.isActive) {
    return { handled: false, reason: "NO_ACTIVE_AGENT_BINDING" }
  }

  const agent = binding.agentProfile

  // 2. Multi-Vector Guardrails / Profanity & Char limits. Runs before any
  // session lookup (via the shared modules/ai/agents/ai-agent-inbound-guard
  // helper, also used by the widget) so a rejected message never creates an
  // AiChatSession row — the daily-limit branch is checked separately below,
  // once a session (and its message count) exists.
  const contentGuard = checkInboundAgentGuardrails({
    text: cleanText,
    maxCharLength: agent.maxCharLength,
    enableProfanityFilter: agent.enableProfanityFilter,
    customBlockedWords: agent.customBlockedWords,
    fallbackMessage: agent.fallbackMessage,
  })
  if (!contentGuard.ok) {
    if (contentGuard.reason === "MAX_CHAR_EXCEEDED") {
      // Deliberate silence (AC-07: no reply for oversize), but never an
      // unaccounted message: record the outcome in a structured log.
      logger.info(
        {
          event: "ai_bot.inbound_silenced",
          agentProfileId: agent.id,
          channel: "WHATSAPP",
          reason: contentGuard.reason,
          inboundMessageId,
        },
        "AI bot deliberately silent"
      )
      return { handled: false, reason: contentGuard.reason }
    }
    // Runs before the session lock, so it takes the same two-state claim
    // itself: concurrent or retried attempts for this wamid must not send
    // the fallback twice.
    const blockedDoneKey = getReplyDoneKey(inboundMessageId)
    if (await hasClaimMarker(blockedDoneKey)) {
      return {
        handled: true,
        reason: "DUPLICATE_REPLY_CLAIMED",
        agentProfileId: agent.id,
      }
    }
    const blockedProcessingKey = getReplyProcessingKey(inboundMessageId)
    if (
      !(await acquireProcessingClaim(
        blockedProcessingKey,
        REPLY_PROCESSING_TTL_BUFFER_SECONDS
      ))
    ) {
      throw new Error(`REPLY_IN_PROGRESS: ${inboundMessageId}`)
    }
    const delivered = await sendBestEffortFallback({
      organizationId,
      phoneNumber: contactPhone,
      deviceId,
      replyToMessageId: inboundMessageId,
      fallbackMessage: contentGuard.replyMessage,
      agentProfileId: agent.id,
      stage: contentGuard.reason,
    })
    if (!delivered) {
      await releaseProcessingClaim(blockedProcessingKey)
      throw new FallbackNotDeliveredError(contentGuard.reason)
    }
    await markClaimDone(blockedDoneKey, REPLY_DONE_TTL_SECONDS)
    return {
      handled: true,
      reason: contentGuard.reason,
      agentProfileId: agent.id,
    }
  }

  // 3. Concurrency Lock & Retrieve/Create AI Chat Session
  const sessionId = `wa_${conversationId}`
  const lockToken = await acquireSessionLock(
    sessionId,
    getAiBotLockTtlSeconds()
  )
  if (!lockToken) {
    // Another message of this conversation is mid-generation. Throw so the
    // awaited webhook dispatch fails and BullMQ retries this one later,
    // instead of dropping it with no reply (AC-01).
    throw new Error(`AI bot session locked (session=${sessionId})`)
  }

  let ownsProcessingClaim = false
  try {
    // Two-state reply claim before any LLM/send call (per AC-01/AC-03). A
    // "done" marker means an outcome was already delivered for this wamid,
    // so a BullMQ retry must never send a second reply for it. A "processing"
    // claim covers this single attempt; it's released in the catch below on
    // any thrown error so a failed attempt (session setup, provider
    // resolution, retrieval, generation) can still be retried instead of
    // being permanently dropped.
    const replyDoneKey = getReplyDoneKey(inboundMessageId)
    const replyProcessingKey = getReplyProcessingKey(inboundMessageId)

    if (await hasClaimMarker(replyDoneKey)) {
      return {
        handled: true,
        reason: "DUPLICATE_REPLY_CLAIMED",
        agentProfileId: agent.id,
      }
    }

    const processingTtlSeconds =
      Math.ceil(getAiBotTimeoutMs() / 1000) +
      REPLY_PROCESSING_TTL_BUFFER_SECONDS
    const acquiredProcessingClaim = await acquireProcessingClaim(
      replyProcessingKey,
      processingTtlSeconds
    )
    if (!acquiredProcessingClaim) {
      // Another attempt holds the claim (or crashed holding it). Throw so
      // BullMQ retries after backoff instead of recording SUCCESS and
      // dropping the message; the claim expires on its own.
      throw new Error(`REPLY_IN_PROGRESS: ${inboundMessageId}`)
    }
    ownsProcessingClaim = true

    let session = await prisma.aiChatSession.findUnique({
      where: { sessionId },
    })

    if (!session) {
      session = await prisma.aiChatSession.create({
        data: {
          sessionId,
          organizationId,
          agentProfileId: agent.id,
          channel: "WHATSAPP",
          customerPhone: contactPhone,
        },
      })
    }

    // Agent prompt-safety check (injection/profanity/oversize) + strike
    // escalation (AC-09). Runs after the session exists (recordSafetyViolation
    // needs session.sessionId) but before the daily-limit count below, using
    // the dedicated ai-agent-guardrails safety check — separate from AC-07's
    // char-limit/blocked-word helper already run above. Escalation is
    // restricted to a PHONE-only, org-scoped ban (banScope: "PHONE_ONLY") so
    // one abusive customer never bans the whole organization.
    const safetyCheck = inspectAgentPromptSafety(cleanText, {
      maxChars: agent.maxCharLength,
      customBlockedWords: agent.customBlockedWords,
      enableProfanityFilter: agent.enableProfanityFilter,
    })
    if (!safetyCheck.ok) {
      const safetyReason = safetyCheck.reason ?? "PROFANITY"
      const delivered = await sendBestEffortFallback({
        organizationId,
        phoneNumber: contactPhone,
        deviceId,
        replyToMessageId: inboundMessageId,
        fallbackMessage: safetyCheck.refusalMessage,
        agentProfileId: agent.id,
        sessionId,
        stage: `SAFETY_${safetyReason}`,
      })
      // Thrown before the strike is recorded, so the retry strikes once.
      if (!delivered) {
        throw new FallbackNotDeliveredError(`SAFETY_${safetyReason}`)
      }
      // Mark done right after the send: a failing strike write below must
      // not let a retry send the fallback twice.
      await markClaimDone(replyDoneKey, REPLY_DONE_TTL_SECONDS)
      try {
        await recordSafetyViolation({
          sessionId: session.sessionId,
          organizationId,
          userId: null,
          customerPhone: contactPhone,
          ipAddress: null,
          content: cleanText,
          reason: safetyReason,
          enableStrikeEscalation: agent.strikeEscalation,
          banScope: "PHONE_ONLY",
        })
      } catch (error) {
        // Refusal already delivered and claim done; a retry can't redo this.
        logStageFailure({
          agentProfileId: agent.id,
          sessionId,
          channel: "WHATSAPP",
          stage: "PERSIST_REPLY",
          error,
        })
      }
      return {
        handled: true,
        reason: `SAFETY_VIOLATION_${safetyReason}`,
        agentProfileId: agent.id,
      }
    }

    // Daily limit (AC-07): customer messages in the last 24h, counted
    // before this message is logged so a blocked message needs no rollback.
    // ponytail: rolling 24h, not a calendar day in the tenant's timezone.
    const inboundMessageCount = await prisma.aiChatMessage.count({
      where: {
        sessionId: session.sessionId,
        role: "user",
        createdAt: { gte: new Date(Date.now() - DAY_MS) },
      },
    })
    const dailyGuard = checkInboundAgentGuardrails({
      text: cleanText,
      maxCharLength: agent.maxCharLength,
      enableProfanityFilter: agent.enableProfanityFilter,
      customBlockedWords: agent.customBlockedWords,
      fallbackMessage: agent.fallbackMessage,
      dailyUserLimit: binding.customDailyUserLimit ?? agent.dailyUserLimit,
      currentMessageCount: inboundMessageCount,
    })
    if (!dailyGuard.ok) {
      const delivered = await sendBestEffortFallback({
        organizationId,
        phoneNumber: contactPhone,
        deviceId,
        replyToMessageId: inboundMessageId,
        fallbackMessage: dailyGuard.replyMessage,
        agentProfileId: agent.id,
        sessionId,
        stage: dailyGuard.reason,
      })
      if (!delivered) {
        throw new FallbackNotDeliveredError(dailyGuard.reason)
      }
      await markClaimDone(replyDoneKey, REPLY_DONE_TTL_SECONDS)
      return {
        handled: true,
        reason: dailyGuard.reason,
        agentProfileId: agent.id,
      }
    }

    // 4. Universal AI Model Resolution (BYOK via Vault or Managed)
    let model
    let resolvedModelName = ""
    try {
      const providerConfig = await resolveAiProviderConfig({
        organizationId,
        modelOverride: undefined,
      })
      resolvedModelName = providerConfig.defaultModel || ""
      model = createAiLanguageModel(providerConfig)
    } catch (error) {
      logStageFailure({
        agentProfileId: agent.id,
        sessionId,
        channel: "WHATSAPP",
        stage: "PROVIDER_RESOLUTION",
        error,
      })
      const delivered = await sendBestEffortFallback({
        organizationId,
        phoneNumber: contactPhone,
        deviceId,
        replyToMessageId: inboundMessageId,
        fallbackMessage: agent.fallbackMessage || GENERIC_AI_FALLBACK_MESSAGE,
        agentProfileId: agent.id,
        sessionId,
        stage: "PROVIDER_RESOLUTION",
      })
      if (!delivered) {
        throw new FallbackNotDeliveredError("PROVIDER_RESOLUTION")
      }
      await markClaimDone(replyDoneKey, REPLY_DONE_TTL_SECONDS)
      return {
        handled: true,
        reason: "AI_PROVIDER_ERROR",
        agentProfileId: agent.id,
      }
    }

    // 5. Vision Capability Fallback Check
    if (isImage && !isVisionSupportedModel(resolvedModelName)) {
      let fallbackResult: { messageId?: string }
      try {
        fallbackResult = await messageService.sendMessage({
          organizationId,
          phoneNumber: contactPhone,
          deviceId,
          type: "interactive",
          replyToMessageId: inboundMessageId,
          interactivePayload: {
            type: "button",
            body: { text: VISION_FALLBACK_TEXT },
            action: {
              buttons: [
                {
                  type: "reply",
                  reply: {
                    id: "action_contact_cs",
                    title: "💬 Hubungi CS Admin",
                  },
                },
              ],
            },
          },
        })
      } catch (sendError) {
        logStageFailure({
          agentProfileId: agent.id,
          sessionId,
          channel: "WHATSAPP",
          stage: "SEND",
          error: sendError,
        })
        const delivered = await sendBestEffortFallback({
          organizationId,
          phoneNumber: contactPhone,
          deviceId,
          replyToMessageId: inboundMessageId,
          fallbackMessage: VISION_FALLBACK_TEXT,
          agentProfileId: agent.id,
          sessionId,
          stage: "SEND",
        })
        if (!delivered) {
          throw new FallbackNotDeliveredError("SEND")
        }
        fallbackResult = { messageId: undefined }
      }

      await markClaimDone(replyDoneKey, REPLY_DONE_TTL_SECONDS)

      try {
        await prisma.aiChatMessage.create({
          data: {
            sessionId: session.sessionId,
            role: "assistant",
            content: VISION_FALLBACK_TEXT,
            promptTokens: 0,
            responseTokens: 0,
          },
        })
      } catch (error) {
        logStageFailure({
          agentProfileId: agent.id,
          sessionId,
          channel: "WHATSAPP",
          stage: "PERSIST_REPLY",
          error,
        })
      }

      return {
        handled: true,
        responseMessageId: fallbackResult.messageId,
        agentProfileId: agent.id,
        tokensUsed: 0,
      }
    }

    // Load multi-turn history using sliding window (last 10 turns)
    const history = await getSlidingWindowMessages(session.sessionId, 10)

    // Construct inbound message content (multimodal or text)
    type MessageContent =
      | string
      | Array<{ type: "text"; text: string } | { type: "image"; image: URL }>

    let userMessageContent: MessageContent = cleanText
    if (isImage && mediaUrl) {
      try {
        const imageUrl = new URL(mediaUrl)
        userMessageContent = [
          {
            type: "text",
            text: trimmedText || "Tolong bantu periksa gambar ini.",
          },
          {
            type: "image",
            image: imageUrl,
          },
        ]
      } catch {
        // Fall back to string text if mediaUrl is invalid URL
        userMessageContent = cleanText
      }
    } else if (isPdf) {
      userMessageContent = trimmedText
        ? `[Dokumen PDF terlampir]: ${trimmedText}`
        : "Tolong bantu periksa dokumen PDF ini kak."
    }

    // The customer row and counters are written only after an outcome was
    // delivered (and the claim marked done), never before generation: a
    // failed attempt BullMQ retries must not leave a duplicate user row
    // that the retry's history, and the rolling daily limit, would count.
    const recordTurn = async (reply?: {
      content: string
      promptTokens: number
      responseTokens: number
      totalTokens: number
    }) => {
      try {
        await prisma.aiChatSession.update({
          where: { id: session.id },
          data: {
            totalMessages: { increment: 1 },
            totalTokens: { increment: reply?.totalTokens ?? 0 },
          },
        })
        await prisma.aiChatMessage.create({
          data: {
            sessionId: session.sessionId,
            role: "user",
            content:
              typeof userMessageContent === "string"
                ? userMessageContent
                : JSON.stringify(userMessageContent),
            promptTokens: 0,
            responseTokens: 0,
          },
        })
        if (reply) {
          await prisma.aiChatMessage.create({
            data: {
              sessionId: session.sessionId,
              role: "assistant",
              content: reply.content,
              promptTokens: reply.promptTokens,
              responseTokens: reply.responseTokens,
            },
          })
        }
      } catch (error) {
        logStageFailure({
          agentProfileId: agent.id,
          sessionId,
          channel: "WHATSAPP",
          stage: "PERSIST_REPLY",
          error,
        })
      }
    }

    const messages: ModelMessage[] = history.map((msg) => {
      if (typeof msg.content === "string" && msg.role === "user") {
        try {
          const parsed = JSON.parse(msg.content)
          if (Array.isArray(parsed) && parsed[0]?.type) {
            const restored = parsed.map((part: Record<string, unknown>) => {
              if (part.type === "image" && part.image) {
                return {
                  type: "image" as const,
                  image: new URL(part.image as string),
                }
              }
              if (part.type === "text" && typeof part.text === "string") {
                return { type: "text" as const, text: part.text }
              }
              return part
            })
            return {
              role: "user" as const,
              content: restored,
            } as unknown as ModelMessage
          }
        } catch {
          // not serialized multimodal JSON, proceed as plain string
        }
      }
      return {
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }
    })
    messages.push({
      role: "user",
      content: userMessageContent,
    } as unknown as ModelMessage)

    // 6. In-Database Hybrid RAG (pgvector + BM25 ts_rank)
    const knowledgeChunks = await searchHybridKnowledge({
      organizationId,
      agentProfileId: agent.id,
      query: cleanText,
      limit: 3,
    })
    const contextText = knowledgeChunks
      .map(
        (chunk, idx) =>
          `[Dokumen ${idx + 1}: ${chunk.title}]\n${chunk.contentMarkdown}`
      )
      .join("\n\n")

    const basePrompt =
      binding.isOverridden && binding.customSystemPrompt
        ? binding.customSystemPrompt
        : agent.systemPrompt ||
          "Anda adalah asisten AI toko resmi yang ramah dan membantu."

    const slotClarificationGuidance =
      "\n\n### PANDUAN PENGGUNAAN ALAT & KLARIFIKASI PARAMETER:\n" +
      "- Jika pertanyaan pengguna membutuhkan data spesifik " +
      "(misal nomor registrasi lab, resi, SKU produk, atau faktur) " +
      "yang belum diberikan atau belum lengkap, JANGAN menebak nilainya.\n" +
      "- Tanyakan klarifikasi secara sopan kepada pengguna untuk " +
      "meminta parameter yang hilang sebelum memanggil alat.\n" +
      "- Jika parameter sudah diberikan pada pesan sebelumnya dalam riwayat, " +
      "langsung panggil alat yang bersangkutan.\n" +
      "- Jika alat mengembalikan NOT_FOUND atau data tidak ada, " +
      "jelaskan secara sopan, sarankan periksa ulang data, " +
      "dan tawarkan bantuan customer service."

    const outOfStockGuidance =
      "\n\n### KEBIJAKAN PRODUK HABIS (OUT OF STOCK):\n" +
      "- Jika produk atau SKU yang dikenali dari gambar atau pencarian " +
      "stoknya 0 atau habis, jelaskan bahwa produk tersebut sedang habis.\n" +
      "- Berikan saran alternatif model atau produk serupa yang tersedia.\n" +
      "- Informasikan opsi tombol aksi [Lihat Model Serupa] " +
      "dan [Kabari Saat Restock] kepada pelanggan."

    const pdfDocumentGuidance = isPdf
      ? "\n\n### PENANGANAN DOKUMEN PDF:\n" +
        "- Pengguna melampirkan dokumen PDF. Berikan konfirmasi " +
        "penerimaan dokumen secara sopan dan jelaskan informasi " +
        "yang dapat Anda bantu terkait dokumen tersebut."
      : ""

    const interactiveGuidance = agent.allowInteractiveReplies
      ? "\n\n### TOMBOL AKSI INTERAKTIF:\n" +
        "- Anda dapat menyertakan tombol aksi interaktif di akhir balasan " +
        "jika relevan dengan format [BUTTON: Label Singkat] " +
        "(maksimal 3 tombol) atau [URL: Label | https://tautan.com].\n" +
        "- Pastikan label tombol ringkas (maksimal 20 karakter) dan relevan."
      : ""

    const systemPrompt = contextText
      ? `${basePrompt}\n\n### KONTEKS DOKUMEN RESMI:\n${contextText}\n\n` +
        "Jawab pertanyaan pelanggan berdasarkan konteks dokumen di atas " +
        `secara ringkas dan sopan.${slotClarificationGuidance}` +
        `${outOfStockGuidance}${pdfDocumentGuidance}${interactiveGuidance}`
      : `${basePrompt}${slotClarificationGuidance}` +
        `${outOfStockGuidance}${pdfDocumentGuidance}${interactiveGuidance}`

    // 7. Build active tools and execute multi-step reasoning
    const tools = await buildAgentTools({
      organizationId,
      agentProfileId: agent.id,
      sessionId: session.sessionId,
    })

    try {
      const aiResult = await generateText({
        model,
        system: systemPrompt,
        messages,
        tools,
        stopWhen: stepCountIs(5),
        timeout: getAiBotTimeoutMs(),
        ...({ maxSteps: 5 } as Record<string, unknown>),
      })

      const rawReplyText =
        aiResult.text.trim() ||
        agent.fallbackMessage ||
        GENERIC_AI_FALLBACK_MESSAGE

      // Tags are always stripped, even when interactive replies are off, so
      // a model that emits [BUTTON:]/[URL:] tags never leaks raw markup.
      const { cleanText, buttons } = parseInteractiveButtons(rawReplyText)
      const hasButtons = agent.allowInteractiveReplies && buttons.length > 0
      // A tag-only reply strips to "", fall back rather than send raw markup.
      const outboundText =
        cleanText || agent.fallbackMessage || GENERIC_AI_FALLBACK_MESSAGE

      // Send reply back to customer. Guarded separately from the
      // generateText call above so a send failure is tagged SEND_FAILED,
      // not GENERATION_FAILED/TIMEOUT, and gets its own fallback attempt.
      let sendResult: Awaited<ReturnType<typeof messageService.sendMessage>>
      try {
        sendResult = hasButtons
          ? await messageService.sendMessage({
              organizationId,
              phoneNumber: contactPhone,
              deviceId,
              type: "interactive",
              interactivePayload: buildInteractivePayload(
                outboundText,
                buttons
              ),
              message: outboundText,
              replyToMessageId: inboundMessageId,
            })
          : await messageService.sendMessage({
              organizationId,
              phoneNumber: contactPhone,
              deviceId,
              message: outboundText,
              replyToMessageId: inboundMessageId,
            })
      } catch (sendError) {
        logStageFailure({
          agentProfileId: agent.id,
          sessionId,
          channel: "WHATSAPP",
          stage: "SEND",
          error: sendError,
        })
        const delivered = await sendBestEffortFallback({
          organizationId,
          phoneNumber: contactPhone,
          deviceId,
          replyToMessageId: inboundMessageId,
          fallbackMessage: agent.fallbackMessage || GENERIC_AI_FALLBACK_MESSAGE,
          agentProfileId: agent.id,
          sessionId,
          stage: "SEND",
        })
        if (!delivered) {
          throw new FallbackNotDeliveredError("SEND")
        }
        await markClaimDone(replyDoneKey, REPLY_DONE_TTL_SECONDS)
        await recordTurn()
        return {
          handled: true,
          reason: "SEND_FAILED",
          agentProfileId: agent.id,
        }
      }

      // Outcome delivered — mark done before any further post-send work
      // (token/usage bookkeeping, message logging) so a later, unrelated
      // failure downstream can never cause a retry to send a second reply.
      await markClaimDone(replyDoneKey, REPLY_DONE_TTL_SECONDS)

      // Bookkeeping failures after a delivered reply are only logged
      // (inside recordTurn); they must not reach the generation catch below
      // and send a fallback too.
      const usage = aiResult.usage as
        { promptTokens?: number; completionTokens?: number } | undefined
      await recordTurn({
        content: outboundText,
        promptTokens: usage?.promptTokens || 0,
        responseTokens: usage?.completionTokens || 0,
        totalTokens: (aiResult.usage?.totalTokens as number) || 0,
      })

      return {
        handled: true,
        responseMessageId: sendResult.messageId,
        agentProfileId: agent.id,
        tokensUsed: aiResult.usage?.totalTokens || 0,
      }
    } catch (error) {
      // SEND stage already handled its own fallback; let it reach the
      // outer catch for a retry instead of sending a GENERATION one too.
      if (error instanceof FallbackNotDeliveredError) {
        throw error
      }
      const timedOut = isAiBotTimeoutError(error)
      logStageFailure({
        agentProfileId: agent.id,
        sessionId,
        channel: "WHATSAPP",
        stage: "GENERATION",
        error,
      })
      const delivered = await sendBestEffortFallback({
        organizationId,
        phoneNumber: contactPhone,
        deviceId,
        replyToMessageId: inboundMessageId,
        fallbackMessage: agent.fallbackMessage || GENERIC_AI_FALLBACK_MESSAGE,
        agentProfileId: agent.id,
        sessionId,
        stage: "GENERATION",
      })
      if (!delivered) {
        throw new FallbackNotDeliveredError("GENERATION")
      }
      await markClaimDone(replyDoneKey, REPLY_DONE_TTL_SECONDS)
      await recordTurn()
      return {
        handled: true,
        reason: timedOut ? "TIMEOUT" : "GENERATION_FAILED",
        agentProfileId: agent.id,
      }
    }
  } catch (error) {
    // An outcome was never delivered (session setup, provider resolution,
    // retrieval or another step above threw before a reply/fallback was
    // sent) — release the processing claim so BullMQ's retry of the same
    // wamid can actually attempt this again instead of being permanently
    // dropped as DUPLICATE_REPLY_CLAIMED (AC-01/AC-03, PR #934 review).
    if (ownsProcessingClaim) {
      await releaseProcessingClaim(getReplyProcessingKey(inboundMessageId))
    }
    throw error
  } finally {
    await releaseSessionLock(sessionId, lockToken)
  }
}
