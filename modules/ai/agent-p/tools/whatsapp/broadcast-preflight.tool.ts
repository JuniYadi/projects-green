import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { validateBroadcastRecipientVariables } from "@/modules/whatsapp/broadcasts/broadcast-preflight"
import type { AgentPTool } from "../../types"

const inputSchema = z.object({ broadcastId: z.string().min(1) })
const outputSchema = z.object({
  broadcastId: z.string(),
  valid: z.boolean(),
  recipientCount: z.number(),
  issues: z.array(z.string()),
})

export const broadcastPreflightTool: AgentPTool<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  name: "whatsapp.broadcast.preflight",
  description: "Validate a WhatsApp broadcast before sending",
  inputSchema,
  outputSchema,
  async execute(input, ctx) {
    const campaign = await prisma.whatsappBroadcastCampaign.findFirst({
      where: {
        organizationId: ctx.session.organizationId,
        id: input.broadcastId,
      },
      include: { recipients: true },
    })
    if (!campaign) throw new Error("BROADCAST_NOT_FOUND")
    const validation = validateBroadcastRecipientVariables({
      templateBody:
        typeof campaign.templateParams === "string"
          ? campaign.templateParams
          : undefined,
      recipients: campaign.recipients,
    })
    const issues = [
      ...validation.missingByRecipient.map(
        (item) =>
          `Recipient ${item.recipientIndex + 1} missing ${item.variables.join(", ")}`
      ),
      ...validation.unknownColumns.map(
        (column) => `Unknown variable ${column}`
      ),
      ...validation.excessColumns.map((column) => `Excess variable ${column}`),
    ]
    return {
      broadcastId: campaign.id,
      valid: validation.isValid,
      recipientCount: campaign.recipients.length,
      issues,
    }
  },
}
