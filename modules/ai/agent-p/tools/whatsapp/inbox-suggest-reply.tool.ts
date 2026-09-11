import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { normalizeIndonesianPhoneNumber } from "@/modules/whatsapp/messages/phone-number"
import type { AgentPTool } from "../../types"

function isPotentialPhoneNumber(val: string): boolean {
  return (
    /^\+?[\d\s\-()]+$/.test(val.trim()) && val.replace(/\D/g, "").length >= 7
  )
}

function extractPhoneVariants(raw: string): string[] {
  const trimmed = raw.trim()
  const normalized = normalizeIndonesianPhoneNumber(trimmed)
  const digits = trimmed.replace(/\D/g, "")
  return Array.from(
    new Set([trimmed, normalized, digits, `+${digits}`].filter(Boolean))
  ) as string[]
}

const inputSchema = z.object({
  conversationId: z.string().min(1).optional(),
  phoneNumber: z.string().min(1).optional(),
  deviceId: z.string().min(1).optional(),
  tone: z.enum(["professional", "friendly", "concise"]).optional(),
})
const outputSchema = z.object({
  conversationId: z.string(),
  phoneNumber: z.string().optional(),
  suggestedReply: z.string(),
})
export const inboxSuggestReplyTool: AgentPTool<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  name: "whatsapp.inbox.suggest_reply",
  description:
    "Suggest a safe reply for a WhatsApp conversation by conversationId or phoneNumber",
  inputSchema,
  outputSchema,
  async execute(input, ctx) {
    const phoneCandidates = [
      ...(input.phoneNumber && isPotentialPhoneNumber(input.phoneNumber)
        ? extractPhoneVariants(input.phoneNumber)
        : []),
      ...(input.conversationId && isPotentialPhoneNumber(input.conversationId)
        ? extractPhoneVariants(input.conversationId)
        : []),
    ]

    const orConditions = [
      ...(input.conversationId ? [{ id: input.conversationId }] : []),
      ...(phoneCandidates.length > 0
        ? [{ contactPhone: { in: phoneCandidates } }]
        : []),
    ]

    if (orConditions.length === 0) {
      throw new Error("CONVERSATION_OR_PHONE_REQUIRED")
    }

    const conversation = await prisma.whatsappConversation.findFirst({
      where: {
        organizationId: ctx.session.organizationId,
        ...(input.deviceId ? { whatsappDeviceId: input.deviceId } : {}),
        OR: orConditions,
      },
      include: {
        whatsappMessages: { orderBy: { createdAt: "desc" }, take: 3 },
      },
    })
    if (!conversation) throw new Error("CONVERSATION_NOT_FOUND")
    const latest = conversation.whatsappMessages[0]?.body?.trim()
    return {
      conversationId: conversation.id,
      phoneNumber: conversation.contactPhone,
      suggestedReply: latest
        ? `Terima kasih atas pesannya. Kami akan membantu menindaklanjuti: ${latest.slice(0, 240)}`
        : "Terima kasih telah menghubungi kami. Ada yang bisa kami bantu?",
    }
  },
}
