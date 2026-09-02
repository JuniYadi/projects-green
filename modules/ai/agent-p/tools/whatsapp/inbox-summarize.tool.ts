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
      status: z.string().nullable(),
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
        whatsappMessages: {
          orderBy: { createdAt: "desc" },
          take: input.limit,
          include: {
            statusHistory: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
    })
    const messages = conversations.flatMap((conversation) =>
      conversation.whatsappMessages.map((message) => ({
        direction: message.direction,
        body: message.body,
        status: message.statusHistory?.[0]?.status ?? null,
        createdAt: message.createdAt.toISOString(),
      }))
    )
    const latestInbound = messages
      .find(
        (m) =>
          (m.direction as string) === "INBOX" ||
          (m.direction as string) === "INBOUND" ||
          (m.direction as string) === "inbound"
      )
      ?.body?.trim()
    const latestOutbound = messages
      .find(
        (m) =>
          (m.direction as string) === "OUTBOX" ||
          (m.direction as string) === "OUTBOUND" ||
          (m.direction as string) === "outbound"
      )
      ?.body?.trim()

    let summary = "Tidak ada riwayat pesan percakapan."
    if (messages.length > 0) {
      const parts: string[] = [
        `Percakapan memiliki ${messages.length} riwayat pesan.`,
      ]
      if (latestInbound) {
        parts.push(
          `Pesan masuk terakhir pelanggan: "${latestInbound.slice(0, 100)}${latestInbound.length > 100 ? "..." : ""}"`
        )
      }
      if (latestOutbound) {
        parts.push(
          `Pesan keluar terakhir: "${latestOutbound.slice(0, 100)}${latestOutbound.length > 100 ? "..." : ""}"`
        )
      }
      summary = parts.join(" ")
    }

    return {
      conversationId: input.conversationId,
      messages,
      summary,
    }
  },
}
