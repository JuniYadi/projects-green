import { generateText, stepCountIs } from "ai"

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
  type CoreMessage,
} from "@/modules/ai/agents/ai-agent-session.service"
import { buildAgentTools } from "@/modules/ai/agents/ai-agent-tools"
import { messageService } from "@/modules/whatsapp/messages/messages.service"

export type ProcessAiBotInboundOptions = {
  organizationId: string
  deviceId: string
  contactPhone: string
  inboundMessageText: string
  conversationId: string
  inboundMessageId: string
}

export type ProcessAiBotInboundResult = {
  handled: boolean
  reason?: string
  responseMessageId?: string
  agentProfileId?: string
  tokensUsed?: number
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
  } = options

  const cleanText = inboundMessageText.trim()
  if (!cleanText) {
    return { handled: false, reason: "EMPTY_TEXT" }
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
        })
      }
      return {
        handled: true,
        reason: "DAILY_LIMIT_REACHED",
        agentProfileId: agent.id,
      }
    }

    // Load multi-turn history using sliding window (last 10 turns)
    const history = await getSlidingWindowMessages(session.id, 10)

    // Log user message
    await prisma.aiChatMessage.create({
      data: {
        sessionId: session.id,
        role: "user",
        content: cleanText,
        promptTokens: 0,
        responseTokens: 0,
      },
    })

    const messages: CoreMessage[] = [...history]
    const lastMsg = messages[messages.length - 1]
    if (!lastMsg || lastMsg.role !== "user" || lastMsg.content !== cleanText) {
      messages.push({ role: "user", content: cleanText })
    }

    // 4. In-Database Hybrid RAG (pgvector + BM25 ts_rank)
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

    const systemPrompt = contextText
      ? `${basePrompt}\n\n### KONTEKS DOKUMEN RESMI:\n${contextText}\n\n` +
        "Jawab pertanyaan pelanggan berdasarkan konteks dokumen di atas " +
        `secara ringkas dan sopan.${slotClarificationGuidance}`
      : `${basePrompt}${slotClarificationGuidance}`

    // 5. Universal AI Model Resolution (BYOK via Vault or Managed)
    let model
    try {
      const providerConfig = await resolveAiProviderConfig({
        organizationId,
        modelOverride: undefined,
      })
      model = createAiLanguageModel(providerConfig)
    } catch (error) {
      console.error("[whatsapp-ai-bot] Failed to resolve AI model:", error)
      if (agent.fallbackMessage) {
        await messageService.sendMessage({
          organizationId,
          phoneNumber: contactPhone,
          message: agent.fallbackMessage,
          deviceId,
        })
      }
      return {
        handled: true,
        reason: "AI_PROVIDER_ERROR",
        agentProfileId: agent.id,
      }
    }

    // 6. Build active tools and execute multi-step reasoning
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

      const replyText =
        aiResult.text.trim() ||
        agent.fallbackMessage ||
        "Mohon maaf, kami belum dapat menjawab pertanyaan Anda saat ini."

      // Send reply back to customer
      const sendResult = await messageService.sendMessage({
        organizationId,
        phoneNumber: contactPhone,
        message: replyText,
        deviceId,
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
          content: replyText,
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
