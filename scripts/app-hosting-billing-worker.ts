/**
 * App Hosting PAYG Billing Worker
 *
 * Scans active PAYG stacks and charges hourly runtime through the billing foundation.
 * Also checks PAYMENT_GRACE stacks for suspension after 24 hours.
 *
 * Usage: bun run scripts/app-hosting-billing-worker.ts
 *
 * This script is designed to run hourly via cron or BullMQ repeatable job.
 */

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { BillingTransactionService } from "@/modules/billing/billing-transaction.service"
import { AppHostingBillingService } from "@/modules/deploy/billing/app-hosting-billing.service"

async function chargeActivePaygStacks(
  billingService: AppHostingBillingService,
): Promise<{ charged: number; graceEntered: number; errors: number }> {
  // Find all stacks with billingMode PAYG and status RUNNING
  const stacks = await prisma.applicationStack.findMany({
    where: {
      billingMode: "PAYG",
      status: "RUNNING",
      hourlyCost: { not: null },
    },
  })

  let charged = 0
  let graceEntered = 0
  let errors = 0

  for (const stack of stacks) {
    try {
      const hourlyCost = new Prisma.Decimal(String(stack.hourlyCost))
      const now = new Date()

      const result = await billingService.chargePaygRuntimeHour({
        organizationId: stack.organizationId,
        stackId: stack.id,
        hourlyCost,
        occurredAt: now,
      })

      if (result.graceEntered) {
        graceEntered++
        console.info(
          `[app-hosting-billing] stack=${stack.id} name=${stack.name} entered PAYMENT_GRACE`,
        )
      } else if (!result.alreadyProcessed) {
        charged++
        console.info(
          `[app-hosting-billing] stack=${stack.id} name=${stack.name} charged ${hourlyCost.toString()}`,
        )
      }
    } catch (error) {
      errors++
      console.error(
        `[app-hosting-billing] stack=${stack.id} name=${stack.name} error:`,
        error,
      )
    }
  }

  return { charged, graceEntered, errors }
}

async function checkGraceSuspension(
  billingService: AppHostingBillingService,
): Promise<{ suspended: number }> {
  // Find stacks in PAYMENT_GRACE
  const stacks = await prisma.applicationStack.findMany({
    where: {
      metadataJson: {
        path: ["billingState"],
        equals: "PAYMENT_GRACE",
      },
    },
  })

  let suspended = 0

  for (const stack of stacks) {
    try {
      const result = await billingService.checkGraceAndSuspend({
        stackId: stack.id,
      })

      if (result.suspended) {
        suspended++
        console.info(
          `[app-hosting-billing] stack=${stack.id} name=${stack.name} SUSPENDED after grace period`,
        )
      }
    } catch (error) {
      console.error(
        `[app-hosting-billing] grace check stack=${stack.id} error:`,
        error,
      )
    }
  }

  return { suspended }
}

async function main() {
  console.info("[app-hosting-billing] worker started")

  const transactions = new BillingTransactionService(prisma)
  const billingService = new AppHostingBillingService(prisma, transactions)

  // Charge active PAYG stacks
  const chargeResult = await chargeActivePaygStacks(billingService)
  console.info(
    `[app-hosting-billing] charges: charged=${chargeResult.charged} grace=${chargeResult.graceEntered} errors=${chargeResult.errors}`,
  )

  // Check grace suspension
  const graceResult = await checkGraceSuspension(billingService)
  console.info(
    `[app-hosting-billing] grace: suspended=${graceResult.suspended}`,
  )

  console.info("[app-hosting-billing] worker completed")
}

main().catch((error) => {
  console.error("[app-hosting-billing] worker failed:", error)
  process.exit(1)
})
