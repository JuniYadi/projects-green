import { generateText } from "ai"
import { prisma } from "@/lib/prisma"
import {
  resolveAiProviderConfig,
  createAiLanguageModel,
} from "@/modules/ai/ai-provider.factory"
import { searchHybridKnowledge } from "@/modules/ai/ai-rag.service"
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
 * Handles an inbound WhatsApp text message through the tenant's AI Agent Profile (if bound and active).
 * Executes Hybrid RAG (pgvector + BM25), injects relevant knowledge chunks, queries the provider (BYOK/Managed),
 * and replies back via the WhatsApp message service.
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

  // 3. Retrieve or Create AI Chat Session for this conversation
  const sessionId = `wa_${conversationId}`
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

  const dailyLimit = binding.customDailyUserLimit ?? agent.dailyUserLimit ?? 30
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

  const systemPrompt = contextText
    ? `${basePrompt}\n\n### KONTEKS DOKUMEN RESMI:\n${contextText}\n\nJawab pertanyaan pelanggan berdasarkan konteks dokumen di atas secara ringkas dan sopan.`
    : basePrompt

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

  // 6. Generate AI response
  try {
    const aiResult = await generateText({
      model,
      system: systemPrompt,
      prompt: cleanText,
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
}
