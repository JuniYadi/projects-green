import { z } from "zod"
import { prisma } from "@/lib/prisma"
import type { AgentPTool } from "../../types"

const inputSchema = z.object({
  days: z.number().int().min(1).max(366).default(30),
})
const outputSchema = z.object({
  days: z.number(),
  total: z.number(),
  averagePerDay: z.number(),
  currency: z.string(),
})

export const billingBurnRateTool: AgentPTool<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  name: "billing.burn_rate",
  description: "Calculate recent billing usage burn rate for this organization",
  inputSchema,
  outputSchema,
  async execute(input, ctx) {
    const since = new Date(Date.now() - input.days * 86400000)
    const rows = await prisma.billingRatedUsage.findMany({
      where: {
        billingAccount: { organizationId: ctx.session.organizationId },
        ratedAt: { gte: since },
      },
      select: { amount: true, currency: true },
    })
    const total = rows.reduce((sum, row) => sum + Number(row.amount), 0)
    return {
      days: input.days,
      total,
      averagePerDay: total / input.days,
      currency: rows[0]?.currency ?? "USD",
    }
  },
}
