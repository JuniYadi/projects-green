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
import { unlinkSync } from "fs"
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

async function acquireLock(): Promise<boolean> {
  // Simple file-based lock to prevent concurrent worker runs.
  // In production, use a distributed lock (e.g., Redis SETNX, Postgres advisory lock).
  const lockPath = "/tmp/app-hosting-billing-worker.lock"
  try {
    const file = Bun.file(lockPath)
    if (await file.exists()) {
      const content = await file.text()
      const pid = parseInt(content.trim(), 10)
      if (!isNaN(pid)) {
        try {
          process.kill(pid, 0) // Check if process is alive
          console.info(`[app-hosting-billing] another worker is running (pid=${pid}), skipping`)
          return false
        } catch {
          // Process doesn't exist — stale lock, safe to take over
        }
      }
    }
    await Bun.write(lockPath, String(process.pid))
    return true
  } catch {
    // If lock file operations fail, proceed anyway (best-effort)
    return true
  }
}

function releaseLock() {
  try {
    unlinkSync("/tmp/app-hosting-billing-worker.lock")
  } catch {
    // Ignore cleanup errors
  }
}

async function main() {
  console.info("[app-hosting-billing] worker started")

  if (!(await acquireLock())) {
    process.exit(0)
  }

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
  releaseLock()
}

main().catch((error) => {
  console.error("[app-hosting-billing] worker failed:", error)
  releaseLock()
  process.exit(1)
})
