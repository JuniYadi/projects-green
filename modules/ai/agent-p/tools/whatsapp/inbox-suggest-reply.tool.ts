import { z } from "zod"
import { prisma } from "@/lib/prisma"
import type { AgentPTool } from "../../types"

const inputSchema = z.object({
  conversationId: z.string().min(1),
  tone: z.enum(["professional", "friendly", "concise"]).default("friendly"),
})
const outputSchema = z.object({
  conversationId: z.string(),
  suggestedReply: z.string(),
})

export const inboxSuggestReplyTool: AgentPTool<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  name: "whatsapp.inbox.suggest_reply",
  description: "Suggest a safe reply for a WhatsApp conversation",
  inputSchema,
  outputSchema,
  async execute(input, ctx) {
    const conversation = await prisma.whatsappConversation.findFirst({
      where: {
        organizationId: ctx.session.organizationId,
        id: input.conversationId,
      },
      include: {
        whatsappMessages: { orderBy: { createdAt: "desc" }, take: 3 },
      },
    })
    if (!conversation) throw new Error("CONVERSATION_NOT_FOUND")
    const latest = conversation.whatsappMessages[0]?.body?.trim()
    return {
      conversationId: conversation.id,
      suggestedReply: latest
        ? `Terima kasih atas pesannya. Kami akan membantu menindaklanjuti: ${latest.slice(0, 240)}`
        : "Terima kasih telah menghubungi kami. Ada yang bisa kami bantu?",
    }
  },
}
