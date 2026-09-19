import { generateText, stepCountIs, type ModelMessage } from "ai"

import { prisma } from "@/lib/prisma"
import {
  resolveAiProviderConfig,
  createAiLanguageModel,
} from "@/modules/ai/ai-provider.factory"
import { searchHybridKnowledge } from "@/modules/ai/ai-rag.service"
import {
  acquireSessionLock,
  getSlidingWindowMessages,
  releaseSessionLock,
} from "@/modules/ai/agents/ai-agent-session.service"
import { buildAgentTools } from "@/modules/ai/agents/ai-agent-tools"
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

  // 2. Multi-Vector Guardrails / Profanity & Char limits
  const maxChar = agent.maxCharLength || 800
  if (cleanText.length > maxChar) {
    return {
      handled: false,
      reason: "MAX_CHAR_EXCEEDED",
    }
  }

  if (agent.enableProfanityFilter && agent.customBlockedWords?.length) {
    const isBlocked = agent.customBlockedWords.some((word: string) =>
      cleanText.toLowerCase().includes(word.toLowerCase().trim())
    )
    if (isBlocked) {
      if (agent.fallbackMessage) {
        await messageService.sendMessage({
          organizationId,
          phoneNumber: contactPhone,
          message: agent.fallbackMessage,
          deviceId,
          replyToMessageId: inboundMessageId,
        })
      }
      return {
        handled: true,
        reason: "BLOCKED_WORD_TRIGGERED",
        agentProfileId: agent.id,
      }
    }
  }

  // 3. Concurrency Lock & Retrieve/Create AI Chat Session
  const sessionId = `wa_${conversationId}`
  const lockToken = await acquireSessionLock(sessionId)
  if (!lockToken) {
    return {
      handled: false,
      reason: "SESSION_LOCKED",
      agentProfileId: agent.id,
    }
  }

  try {
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

    // Increment message count atomically and check limit
    const updatedSession = await prisma.aiChatSession.update({
      where: { id: session.id },
      data: { totalMessages: { increment: 1 } },
    })

    const dailyLimit =
      binding.customDailyUserLimit ?? agent.dailyUserLimit ?? 30
    if (updatedSession.totalMessages > dailyLimit) {
      // Rollback the increment
      await prisma.aiChatSession.update({
        where: { id: session.id },
        data: { totalMessages: { decrement: 1 } },
      })
      if (agent.fallbackMessage) {
        await messageService.sendMessage({
          organizationId,
          phoneNumber: contactPhone,
          message: agent.fallbackMessage,
          deviceId,
          replyToMessageId: inboundMessageId,
        })
      }
      return {
        handled: true,
        reason: "DAILY_LIMIT_REACHED",
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
      console.error("[whatsapp-ai-bot] Failed to resolve AI model:", error)
      if (agent.fallbackMessage) {
        await messageService.sendMessage({
          organizationId,
          phoneNumber: contactPhone,
          message: agent.fallbackMessage,
          deviceId,
          replyToMessageId: inboundMessageId,
        })
      }
      return {
        handled: true,
        reason: "AI_PROVIDER_ERROR",
        agentProfileId: agent.id,
      }
    }

    // 5. Vision Capability Fallback Check
    if (isImage && !isVisionSupportedModel(resolvedModelName)) {
      const fallbackResult = await messageService.sendMessage({
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

      await prisma.aiChatMessage.create({
        data: {
          sessionId: session.id,
          role: "assistant",
          content: VISION_FALLBACK_TEXT,
          promptTokens: 0,
          responseTokens: 0,
        },
      })

      return {
        handled: true,
        responseMessageId: fallbackResult.messageId,
        agentProfileId: agent.id,
        tokensUsed: 0,
      }
    }

    // Load multi-turn history using sliding window (last 10 turns)
    const history = await getSlidingWindowMessages(session.id, 10)

    // Construct inbound message content (multimodal or text)
    type MessageContent =
      | string
      | Array<
          | { type: "text"; text: string }
          | { type: "image"; image: URL }
        >

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

    // Log user message
    await prisma.aiChatMessage.create({
      data: {
        sessionId: session.id,
        role: "user",
        content:
          typeof userMessageContent === "string"
            ? userMessageContent
            : JSON.stringify(userMessageContent),
        promptTokens: 0,
        responseTokens: 0,
      },
    })

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
    messages.push(
      { role: "user", content: userMessageContent } as unknown as ModelMessage
    )

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

    const interactiveGuidance =
      "\n\n### TOMBOL AKSI INTERAKTIF:\n" +
      "- Anda dapat menyertakan tombol aksi interaktif di akhir balasan " +
      "jika relevan dengan format [BUTTON: Label Singkat] " +
      "(maksimal 3 tombol) atau [URL: Label | https://tautan.com].\n" +
      "- Pastikan label tombol ringkas (maksimal 20 karakter) dan relevan."

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
      sessionId: session.id,
    })

    try {
      const aiResult = await generateText({
        model,
        system: systemPrompt,
        messages,
        tools,
        stopWhen: stepCountIs(5),
        ...({ maxSteps: 5 } as Record<string, unknown>),
      })

      const rawReplyText =
        aiResult.text.trim() ||
        agent.fallbackMessage ||
        "Mohon maaf, kami belum dapat menjawab pertanyaan Anda saat ini."

      const { cleanText, buttons } = parseInteractiveButtons(rawReplyText)
      const hasButtons = buttons.length > 0
      const outboundText = cleanText || rawReplyText

      // Send reply back to customer
      const sendResult = hasButtons
        ? await messageService.sendMessage({
            organizationId,
            phoneNumber: contactPhone,
            deviceId,
            type: "interactive",
            interactivePayload: buildInteractivePayload(cleanText, buttons),
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
      await prisma.aiChatSession.update({
        where: { id: session.id },
        data: {
          totalTokens: {
            increment: (aiResult.usage?.totalTokens as number) || 0,
          },
        },
      })

      // Log chat message
      const usage = aiResult.usage as
        | { promptTokens?: number; completionTokens?: number }
        | undefined
      await prisma.aiChatMessage.create({
        data: {
          sessionId: session.id,
          role: "assistant",
          content: outboundText,
          promptTokens: usage?.promptTokens || 0,
          responseTokens: usage?.completionTokens || 0,
        },
      })

      return {
        handled: true,
        responseMessageId: sendResult.messageId,
        agentProfileId: agent.id,
        tokensUsed: aiResult.usage?.totalTokens || 0,
      }
    } catch (error) {
      console.error("[whatsapp-ai-bot] AI generation error:", error)
      if (agent.fallbackMessage) {
        await messageService.sendMessage({
          organizationId,
          phoneNumber: contactPhone,
          message: agent.fallbackMessage,
          deviceId,
          replyToMessageId: inboundMessageId,
        })
      }
      return {
        handled: true,
        reason: "GENERATION_FAILED",
        agentProfileId: agent.id,
      }
    }
  } finally {
    await releaseSessionLock(sessionId, lockToken)
  }
}
