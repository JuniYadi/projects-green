import { z } from "zod"
import { prisma } from "@/lib/prisma"
import type { AgentPTool } from "../../types"

const inputSchema = z.object({
  conversationId: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(100).default(20),
})
const outputSchema = z.object({
  conversationId: z.string().optional(),
  messages: z.array(
    z.object({
      direction: z.string(),
      body: z.string().nullable(),
      createdAt: z.string(),
    })
  ),
  summary: z.string(),
})

export const inboxSummarizeTool: AgentPTool<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  name: "whatsapp.inbox.summarize",
  description: "Summarize recent WhatsApp inbox messages for this organization",
  inputSchema,
  outputSchema,
  async execute(input, ctx) {
    const where = {
      organizationId: ctx.session.organizationId,
      ...(input.conversationId ? { id: input.conversationId } : {}),
    }
    const conversations = await prisma.whatsappConversation.findMany({
      where,
      take: input.limit,
      orderBy: { lastMessageAt: "desc" },
      include: {
        whatsappMessages: { orderBy: { createdAt: "desc" }, take: input.limit },
      },
    })
    const messages = conversations.flatMap((conversation) =>
      conversation.whatsappMessages.map((message) => ({
        direction: message.direction,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
      }))
    )
    return {
      conversationId: input.conversationId,
      messages,
      summary: messages.length
        ? `Recent inbox contains ${messages.length} messages.`
        : "No recent inbox messages.",
    }
  },
}
