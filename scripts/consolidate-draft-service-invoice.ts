/**
 * Consolidate Duplicate Line Items on a DRAFT Service Invoice
 *
 * Usage:
 *   bun --env-file=.env.readonly scripts/consolidate-draft-service-invoice.ts [--invoiceId <id>]
 *   bun scripts/consolidate-draft-service-invoice.ts --apply [--invoiceId <id>]
 */

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

const args = process.argv.slice(2)
const isApply = args.includes("--apply")
const invoiceIdArg =
  args[args.indexOf("--invoiceId") + 1] || "cmu4teejt0002019nkyodmbuk"

async function main() {
  console.log(
    `[consolidate] Mode: ${isApply ? "APPLY (Write)" : "DRY-RUN (Read-only)"}`
  )
  console.log(`[consolidate] Target invoice ID: ${invoiceIdArg}`)

  const invoice = await prisma.billingInvoice.findUnique({
    where: { id: invoiceIdArg },
    include: {
      billingAccount: true,
      lines: true,
    },
  })

  if (!invoice) {
    console.error(`[consolidate] Invoice ${invoiceIdArg} not found!`)
    process.exit(1)
  }

  console.log(
    `[consolidate] Found invoice ${invoice.invoiceNumber} (Status: ${invoice.status})`
  )
  console.log(
    `[consolidate] Current total amount: ${invoice.totalAmount} ${invoice.currency}`
  )
  console.log(`[consolidate] Current line items count: ${invoice.lines.length}`)

  if (invoice.status !== "DRAFT") {
    console.warn(
      `[consolidate] Warning: Invoice status is ${invoice.status} (not DRAFT). Only DRAFT invoices can be consolidated.`
    )
    if (isApply) {
      console.error(`[consolidate] Refusing to modify non-DRAFT invoice.`)
      process.exit(1)
    }
  }

  // Check if any lines have "WhatsApp overage quota credit" without category
  // If so, look up the WhatsApp ledgers to determine the actual category
  const orgId = invoice.billingAccount?.organizationId
  let resolvedWaCategory: string | null = null
  if (orgId) {
    const recentLedger = await prisma.whatsappBillingLedger.findFirst({
      where: {
        organizationId: orgId,
        createdAt: {
          gte: invoice.periodStart,
          lte: invoice.periodEnd,
        },
      },
      select: { category: true },
    })
    resolvedWaCategory = recentLedger?.category ?? "UTILITY"
  }

  // Group lines by (lineType, unitPrice, currency, baseDescription)
  type GroupKey = string
  const groups = new Map<
    GroupKey,
    {
      targetDescription: string
      lineType: string
      unitPrice: Prisma.Decimal
      currency: string
      totalQuantity: Prisma.Decimal
      totalAmount: Prisma.Decimal
      lines: typeof invoice.lines
    }
  >()

  for (const line of invoice.lines) {
    let description = line.description
    // If description is generic WhatsApp overage without category, enrich with resolved category
    if (description === "WhatsApp overage quota credit" && resolvedWaCategory) {
      description = `WhatsApp overage quota credit (${resolvedWaCategory})`
    }

    const key = `${line.lineType}|${line.unitPrice.toString()}|${line.currency}|${description}`
    const existing = groups.get(key)
    const qty =
      line.quantity instanceof Prisma.Decimal
        ? line.quantity
        : new Prisma.Decimal(Number(line.quantity ?? 0))
    const amt =
      line.amount instanceof Prisma.Decimal
        ? line.amount
        : new Prisma.Decimal(Number(line.amount ?? 0))

    if (!existing) {
      groups.set(key, {
        targetDescription: description,
        lineType: line.lineType,
        unitPrice: line.unitPrice,
        currency: line.currency,
        totalQuantity: qty,
        totalAmount: amt,
        lines: [line],
      })
    } else {
      existing.totalQuantity = existing.totalQuantity.plus(qty)
      existing.totalAmount = existing.totalAmount.plus(amt)
      existing.lines.push(line)
    }
  }

  console.log(
    `\n[consolidate] Grouped ${invoice.lines.length} lines into ${groups.size} consolidated line(s):`
  )

  for (const [, group] of groups.entries()) {
    console.log(`  - [${group.lineType}] "${group.targetDescription}"`)
    console.log(
      `    Original lines: ${group.lines.length} -> New QTY: ${group.totalQuantity.toString()}, Unit Price: ${group.unitPrice.toString()} ${group.currency}, Total: ${group.totalAmount.toString()} ${group.currency}`
    )
  }

  if (!isApply) {
    console.log(
      `\n[consolidate] Dry run completed. No database changes were made.`
    )
    console.log(`[consolidate] To apply changes to the database, run:`)
    console.log(
      `  bun scripts/consolidate-draft-service-invoice.ts --apply --invoiceId ${invoiceIdArg}`
    )
    await prisma.$disconnect()
    return
  }

  // Execute consolidation in a transaction
  await prisma.$transaction(async (tx) => {
    for (const group of groups.values()) {
      if (group.lines.length === 0) continue

      const [keptLine, ...redundantLines] = group.lines

      // Update the kept line
      await tx.billingInvoiceLine.update({
        where: { id: keptLine.id },
        data: {
          description: group.targetDescription,
          quantity: group.totalQuantity,
          amount: group.totalAmount,
        },
      })

      if (redundantLines.length > 0) {
        const redundantIds = redundantLines.map((l) => l.id)

        // Find adjustments that referenced any of the redundant lines and point them to keptLine
        const adjustments = await tx.billingAdjustment.findMany({
          where: {
            invoiceId: invoice.id,
          },
        })

        for (const adj of adjustments) {
          const meta = (adj.metadataJson ?? {}) as Record<string, unknown>
          if (
            typeof meta.invoiceLineId === "string" &&
            redundantIds.includes(meta.invoiceLineId)
          ) {
            await tx.billingAdjustment.update({
              where: { id: adj.id },
              data: {
                metadataJson: {
                  ...meta,
                  invoiceLineId: keptLine.id,
                },
              },
            })
          }
        }

        // Delete redundant lines
        await tx.billingInvoiceLine.deleteMany({
          where: { id: { in: redundantIds } },
        })
      }
    }
  })

  console.log(
    `\n✅ [consolidate] Successfully consolidated lines on invoice ${invoiceIdArg}!`
  )
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error("[consolidate] Error:", err)
  process.exit(1)
})
