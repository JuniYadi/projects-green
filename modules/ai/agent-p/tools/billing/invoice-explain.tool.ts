import { z } from "zod"
import { prisma } from "@/lib/prisma"
import type { AgentPTool } from "../../types"

const inputSchema = z.object({ invoiceId: z.string().min(1) })
const outputSchema = z.object({
  invoiceId: z.string(),
  invoiceNumber: z.string(),
  status: z.string(),
  currency: z.string(),
  subtotal: z.number(),
  tax: z.number(),
  discount: z.number(),
  total: z.number(),
  lineCount: z.number(),
  explanation: z.string(),
})

export const invoiceExplainTool: AgentPTool<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  name: "billing.invoice_explain",
  description:
    "Explain an organization invoice without exposing payment secrets",
  inputSchema,
  outputSchema,
  async execute(input, ctx) {
    const invoice = await prisma.billingInvoice.findFirst({
      where: {
        id: input.invoiceId,
        billingAccount: { organizationId: ctx.session.organizationId },
      },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        currency: true,
        subtotalAmount: true,
        taxAmount: true,
        discountAmount: true,
        totalAmount: true,
        lines: { select: { id: true } },
      },
    })
    if (!invoice) throw new Error("INVOICE_NOT_FOUND")
    const subtotal = Number(invoice.subtotalAmount)
    const tax = Number(invoice.taxAmount)
    const discount = Number(invoice.discountAmount)
    const total = Number(invoice.totalAmount)
    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      currency: invoice.currency,
      subtotal,
      tax,
      discount,
      total,
      lineCount: invoice.lines.length,
      explanation: `Invoice ${invoice.invoiceNumber} totals ${total} ${invoice.currency} across ${invoice.lines.length} line item(s).`,
    }
  },
}
