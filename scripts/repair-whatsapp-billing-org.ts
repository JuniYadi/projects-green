#!/usr/bin/env bun
/**
 * WhatsApp Billing & Ledger Repair Script
 *
 * Diagnoses and fixes:
 * 1. Device quotaBaseOut desync (e.g. quotaBaseOut > 0 when monthly quota is exhausted).
 * 2. Unbilled overage messages where balance was not deducted (pricingBillable is null).
 * 3. Historical ledgers stuck in CHARGED_PENDING_VERIFY whose broadcasts are already completed.
 *
 * Usage:
 *   # Dry-run mode (DEFAULT - read-only, no mutations)
 *   bun --env-file=.env.readonly scripts/repair-whatsapp-billing-org.ts
 *
 *   # Apply changes (requires read-write DATABASE_URL in .env)
 *   bun --env-file=.env scripts/repair-whatsapp-billing-org.ts --apply
 *
 * Options:
 *   --orgId=<orgId>                  Target organization (default: org_01M0RXAEFHFYE98466H0J85P18)
 *   --month=<YYYY-MM>                Billing period to inspect (default: current month e.g. 2026-09)
 *   --apply                          Execute the repairs (default is DRY-RUN)
 *   --debit-balance                  Debit organization balance for post-topup overages (default: true when --apply)
 *   --no-debit-balance               Skip debiting organization balance
 *   --confirm-pending-ledgers        Confirm old stuck CHARGED_PENDING_VERIFY ledgers (default: true)
 *   --include-pre-topup-overage      Also debit overage that occurred before top-up date from balance instead of negative quota (default: false)
 *   --set-overdraft=<number>         Directly set the negative overdraft quotaBaseOut (e.g. -313)
 */

import {
  Prisma,
  WhatsappBillingCategory,
  WhatsappBillingStatus,
} from "@prisma/client"
import { prisma } from "../lib/prisma"
import { BillingTransactionService } from "../modules/billing/billing-transaction.service"

// Parse CLI args
const args = process.argv.slice(2)
const isApply = args.includes("--apply")
const isDryRun = !isApply
const orgIdArg =
  args.find((a) => a.startsWith("--orgId="))?.split("=")[1] ??
  "org_01M0RXAEFHFYE98466H0J85P18"
const deviceIdArg = args.find((a) => a.startsWith("--deviceId="))?.split("=")[1]
const phoneArg = args.find((a) => a.startsWith("--phone="))?.split("=")[1]
const monthArg =
  args.find((a) => a.startsWith("--month="))?.split("=")[1] ?? "2026-09"
const isAllTime = args.includes("--all-time")
const allowanceOverrideArg = args
  .find((a) => a.startsWith("--allowance="))
  ?.split("=")[1]
const setOverdraftArg = args
  .find((a) => a.startsWith("--set-overdraft="))
  ?.split("=")[1]
const shouldDebitBalance = !args.includes("--no-debit-balance")
const shouldConfirmPending = !args.includes("--no-confirm-pending")
const includePreTopupOverage =
  args.includes("--include-pre-topup-overage") || args.includes("--all-overage")

interface _RepairSummary {
  orgId: string
  period: string
  mode: "DRY-RUN" | "APPLY"
  device: {
    id: string
    phoneNumber: string
    currentQuotaBase: number
    currentQuotaBaseOut: number
    targetQuotaBaseOut: number
    needsQuotaFix: boolean
  } | null
  billingAccount: {
    id: string
    currency: string
    currentBalance: number
    expectedDeduction: number
    targetBalance: number
  } | null
  ledgers: {
    totalPeriodLedgers: number
    totalCreditsConsumed: number
    allowanceCredits: number
    overageCreditsTotal: number
    overageCreditsPreTopup: number
    overageCreditsPostTopup: number
    unbilledLedgersPostTopupCount: number
    stuckPendingLedgersCount: number
  }
}

async function main() {
  console.log(
    "================================================================================"
  )
  console.log(
    ` WhatsApp Billing & Ledger Repair Script [${isApply ? "EXECUTE / APPLY" : "DRY RUN"}]`
  )
  console.log(
    "================================================================================"
  )
  console.log(`Target Org ID : ${orgIdArg}`)
  console.log(`Target Period : ${monthArg}`)
  console.log(
    `Mode          : ${isApply ? "⚠️  APPLY (Modifications will be written)" : "🛡️  DRY-RUN (No changes will be saved)"}`
  )
  console.log(
    "--------------------------------------------------------------------------------\n"
  )

  const [yearStr, monthStr] = monthArg.split("-")
  const year = Number(yearStr)
  const month = Number(monthStr)
  const startDate = new Date(Date.UTC(year, month - 1, 1))
  const endDate = new Date(
    Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1)
  )

  // 1. Fetch Organization Device
  const deviceWhere: Prisma.WhatsappDeviceWhereInput = {
    organizationId: orgIdArg,
  }
  if (deviceIdArg) deviceWhere.id = deviceIdArg
  if (phoneArg) deviceWhere.phoneNumber = { contains: phoneArg }

  const device = await prisma.whatsappDevice.findFirst({
    where: deviceWhere,
    select: {
      id: true,
      phoneNumber: true,
      quotaBase: true,
      quotaBaseOut: true,
      addonQuota: true,
      addonQuotaTotal: true,
      status: true,
      whatsappProfile: true,
    },
  })

  if (!device) {
    console.error(`❌ No WhatsappDevice found for organization ${orgIdArg}`)
    process.exit(1)
  }

  const profile = device.whatsappProfile as Record<string, unknown> | null
  const deviceName =
    (profile?.verified_name as string) ||
    (profile?.name as string) ||
    device.phoneNumber
  console.log(
    `📱 Device Found: ${deviceName} (${device.phoneNumber}) [ID: ${device.id}]`
  )
  console.log(`   - Quota Base     : ${device.quotaBase}`)
  console.log(`   - Current Left   : ${device.quotaBaseOut}`)
  console.log(
    `   - Addon Quota    : ${device.addonQuota} / ${device.addonQuotaTotal}\n`
  )

  // 2. Fetch Billing Account
  const billingAccount = await prisma.billingAccount.findUnique({
    where: { organizationId: orgIdArg },
  })

  if (!billingAccount) {
    console.error(`❌ No BillingAccount found for organization ${orgIdArg}`)
    process.exit(1)
  }

  const currentBalanceNum = Number(billingAccount.balance)
  console.log(`💳 Billing Account: ${billingAccount.id}`)
  console.log(`   - Currency       : ${billingAccount.currency}`)
  console.log(
    `   - Current Balance: ${billingAccount.currency} ${currentBalanceNum.toLocaleString("id-ID")}\n`
  )

  // 3. Inspect Ledgers in Period
  const totalOrgLedgersCount = await prisma.whatsappBillingLedger.count({
    where: { organizationId: orgIdArg },
  })

  const periodLedgerWhere: Prisma.WhatsappBillingLedgerWhereInput = {
    organizationId: orgIdArg,
    ...(isAllTime ? {} : { createdAt: { gte: startDate, lt: endDate } }),
    OR: [
      { whatsappDeviceId: device.id },
      { whatsappDeviceId: null },
      { quotaKey: device.id },
    ],
  }

  const periodLedgers = await prisma.whatsappBillingLedger.findMany({
    where: periodLedgerWhere,
    orderBy: { createdAt: "asc" },
  })

  console.log(
    `📊 Period [${isAllTime ? "ALL-TIME" : monthArg}] Ledgers Analysis:`
  )
  console.log(`   - Total Org Ledgers (All Time) : ${totalOrgLedgersCount}`)
  console.log(`   - Filtered Period Ledgers      : ${periodLedgers.length}`)

  // Detect latest Topup date if any
  const latestTopup = await prisma.billingAdjustment.findFirst({
    where: {
      billingAccountId: billingAccount.id,
      adjustmentType: "CREDIT",
      metadataJson: { path: ["source"], equals: "TOPUP" },
    },
    orderBy: { createdAt: "desc" },
  })

  const topupDate = latestTopup?.createdAt ?? new Date(0)
  if (latestTopup) {
    console.log(
      `   - Latest Topup Found           : ${billingAccount.currency} ${Number(latestTopup.amount).toLocaleString("id-ID")} on ${latestTopup.createdAt.toISOString()}`
    )
  } else {
    console.log(
      `   - Topup Found                  : None (all overages considered pre-topup)`
    )
  }

  const quotaBaseNum =
    allowanceOverrideArg !== undefined
      ? Number(allowanceOverrideArg)
      : Number(device.quotaBase)
  if (allowanceOverrideArg !== undefined) {
    console.log(
      `   - Quota Allowance Override     : ${quotaBaseNum} credits (via --allowance=${allowanceOverrideArg})`
    )
  }

  let cumulativeCredits = 0
  let overagePreTopupCredits = 0
  let overagePostTopupCredits = 0
  let alreadyBillableCount = 0
  let unbilledBillableNullCount = 0
  const unbilledPostTopupLedgers: typeof periodLedgers = []
  const unbilledPreTopupLedgers: typeof periodLedgers = []

  for (const ledger of periodLedgers) {
    if (ledger.isReverted) continue
    const val = Number(ledger.quotaValue)
    cumulativeCredits += val

    if (ledger.pricingBillable) {
      alreadyBillableCount++
    } else {
      unbilledBillableNullCount++
    }

    if (cumulativeCredits > quotaBaseNum) {
      const overageForThisMsg = Math.min(val, cumulativeCredits - quotaBaseNum)
      if (latestTopup && ledger.createdAt >= topupDate) {
        overagePostTopupCredits += overageForThisMsg
        if (!ledger.pricingBillable) {
          unbilledPostTopupLedgers.push(ledger)
        }
      } else {
        overagePreTopupCredits += overageForThisMsg
        if (!ledger.pricingBillable) {
          unbilledPreTopupLedgers.push(ledger)
        }
      }
    }
  }

  const totalOverageCredits = Math.max(0, cumulativeCredits - quotaBaseNum)
  const targetUnbilledLedgers = includePreTopupOverage
    ? [...unbilledPreTopupLedgers, ...unbilledPostTopupLedgers]
    : unbilledPostTopupLedgers

  console.log(
    `   - Total Credits Consumed       : ${cumulativeCredits} (Allowance: ${quotaBaseNum})`
  )
  console.log(`   - Total Overage Credits        : ${totalOverageCredits}`)
  console.log(
    `     ├─ Pre-Topup Overage         : ${overagePreTopupCredits} credits (Unbilled: ${unbilledPreTopupLedgers.length} ledgers)`
  )
  console.log(
    `     └─ Post-Topup Overage        : ${overagePostTopupCredits} credits (Unbilled: ${unbilledPostTopupLedgers.length} ledgers)`
  )
  console.log(`   - Database Ledger Status in DB :`)
  console.log(
    `     ├─ Already pricingBillable=true  : ${alreadyBillableCount} ledgers (PAYG Saldo in DB)`
  )
  console.log(
    `     └─ Unset pricingBillable (null)  : ${unbilledBillableNullCount} ledgers (Allowance Quota in DB)`
  )
  console.log(
    `   - Target Ledgers to Convert    : ${targetUnbilledLedgers.length} ledgers ${includePreTopupOverage ? "(including pre-topup)" : "(post-topup only)"}`
  )

  if (periodLedgers.length === 0 && totalOrgLedgersCount > 0) {
    console.log(
      `\n💡 Tip: No ledgers found in period '${monthArg}'. Try running with --all-time or checking the correct --month=YYYY-MM.`
    )
  } else if (totalOverageCredits === 0 && cumulativeCredits > 0) {
    console.log(
      `\n💡 Tip: Consumed credits (${cumulativeCredits}) <= Allowance (${quotaBaseNum}). If this org should have 0 package quota (pure PAYG), pass --allowance=0.`
    )
  } else if (
    unbilledPostTopupLedgers.length === 0 &&
    unbilledPreTopupLedgers.length > 0 &&
    !includePreTopupOverage
  ) {
    console.log(
      `\n💡 Tip: All ${unbilledPreTopupLedgers.length} overage ledgers occurred BEFORE the top-up date. To convert them to PAYG Saldo, pass --include-pre-topup-overage.`
    )
  }

  // 4. Inspect Stuck Pending Ledgers (CHARGED_PENDING_VERIFY)
  const stuckPendingLedgers = await prisma.whatsappBillingLedger.findMany({
    where: {
      organizationId: orgIdArg,
      whatsappDeviceId: device.id,
      status: WhatsappBillingStatus.CHARGED_PENDING_VERIFY,
    },
    orderBy: { createdAt: "asc" },
  })
  console.log(
    `\n⏳ Stuck Pending Ledgers (CHARGED_PENDING_VERIFY): ${stuckPendingLedgers.length} records`
  )

  // 5. Calculate Pricing for Unbilled Overage
  // Fetch Base Price for UTILITY (or respective categories)
  const basePrices = await prisma.whatsappBasePrice.findMany({
    where: { isActive: true },
  })
  const priceMap = new Map<string, number>()
  for (const bp of basePrices) {
    priceMap.set(bp.category, Number(bp.basePrice))
  }
  const defaultUtilityPrice = priceMap.get("UTILITY") ?? 357

  let totalDeductionAmount = 0
  for (const ledger of targetUnbilledLedgers) {
    const rate = priceMap.get(ledger.category) ?? defaultUtilityPrice
    totalDeductionAmount += rate * Number(ledger.quotaValue)
  }

  const targetBalanceNum = Math.max(0, currentBalanceNum - totalDeductionAmount)

  // Quota calculation:
  // When quota allowance is exhausted, quotaBaseOut is clamped to 0.
  // Messages after quota exhaustion are PAYG Saldo transactions, not negative credit.
  // This ensures a clean refill on October 1st (PR #774).
  let targetQuotaBaseOut: number
  let targetQuotaReason: string

  if (setOverdraftArg !== undefined) {
    targetQuotaBaseOut = Number(setOverdraftArg)
    targetQuotaReason = `Explicitly set via --set-overdraft=${setOverdraftArg}`
  } else {
    targetQuotaBaseOut =
      cumulativeCredits >= quotaBaseNum ? 0 : quotaBaseNum - cumulativeCredits
    targetQuotaReason = `Allowance ${quotaBaseNum} exhausted (0 left). Overages handled via PAYG Saldo.`
  }

  console.log(
    "\n--------------------------------------------------------------------------------"
  )
  console.log("📋 Proposed Corrections:")
  console.log(
    "--------------------------------------------------------------------------------"
  )
  console.log(`1. Device Quota Base Out:`)
  console.log(`   Current: ${device.quotaBaseOut}`)
  console.log(`   Target : ${targetQuotaBaseOut} (${targetQuotaReason})`)

  console.log(`\n2. Stuck Pending Ledgers:`)
  console.log(
    `   Update ${stuckPendingLedgers.length} records from CHARGED_PENDING_VERIFY -> CONFIRMED`
  )

  console.log(`\n3. Unbilled Overage Ledgers to Convert to PAYG:`)
  console.log(
    `   Update ${targetUnbilledLedgers.length} ledgers -> pricingBillable = true`
  )

  console.log(`\n4. Balance Deduction:`)
  console.log(
    `   Target unbilled messages     : ${targetUnbilledLedgers.length}`
  )
  console.log(
    `   Total deduction amount       : ${billingAccount.currency} ${totalDeductionAmount.toLocaleString("id-ID")}`
  )
  console.log(
    `   Current Balance              : ${billingAccount.currency} ${currentBalanceNum.toLocaleString("id-ID")}`
  )
  console.log(
    `   Target Balance After Debit   : ${billingAccount.currency} ${targetBalanceNum.toLocaleString("id-ID")}`
  )
  console.log(
    "--------------------------------------------------------------------------------\n"
  )

  if (isDryRun) {
    console.log(
      "🔒 DRY-RUN COMPLETED: No changes were applied to the database."
    )
    console.log("👉 To apply these fixes, run:")
    console.log(
      `   bun --env-file=.env scripts/repair-whatsapp-billing-org.ts --apply\n`
    )
    return
  }

  // ─── EXECUTE REPAIR TRANSACTION ──────────────────────────────────────────────
  console.log("🚀 Applying fixes inside database transaction...")

  await prisma.$transaction(async (tx) => {
    // A. Fix Device QuotaBaseOut
    if (Number(device.quotaBaseOut) !== targetQuotaBaseOut) {
      await tx.whatsappDevice.update({
        where: { id: device.id },
        data: { quotaBaseOut: new Prisma.Decimal(targetQuotaBaseOut) },
      })
      console.log(
        `   ✅ Device ${device.id} quotaBaseOut updated to ${targetQuotaBaseOut}`
      )
    }

    // B. Fix Stuck Pending Ledgers
    if (shouldConfirmPending && stuckPendingLedgers.length > 0) {
      const pendingIds = stuckPendingLedgers.map((l) => l.id)
      const res = await tx.whatsappBillingLedger.updateMany({
        where: { id: { in: pendingIds } },
        data: {
          status: WhatsappBillingStatus.CONFIRMED,
          lastStatus: "SENT",
        },
      })
      console.log(`   ✅ Confirmed ${res.count} pending ledgers`)
    }

    // C. Mark Unbilled Overage Ledgers as pricingBillable
    const targetLedgersToMark = includePreTopupOverage
      ? periodLedgers.filter(
          (l) => !l.isReverted && !l.pricingBillable && Number(l.quotaValue) > 0
        )
      : unbilledPostTopupLedgers

    if (targetLedgersToMark.length > 0) {
      let markedCount = 0
      // Group by category to batch update accurately
      const byCategory = new Map<WhatsappBillingCategory, string[]>()
      for (const ledger of targetLedgersToMark) {
        const cat = ledger.category || WhatsappBillingCategory.UTILITY
        const list = byCategory.get(cat) ?? []
        list.push(ledger.id)
        byCategory.set(cat, list)
      }

      for (const [cat, ids] of byCategory.entries()) {
        const res = await tx.whatsappBillingLedger.updateMany({
          where: { id: { in: ids } },
          data: {
            pricingBillable: true,
            pricingCategory: cat,
          },
        })
        markedCount += res.count
      }
      console.log(
        `   ✅ Marked ${markedCount} ledgers as pricingBillable = true`
      )
    }

    // D. Debit Organization Balance if requested and deduction > 0
    if (shouldDebitBalance && totalDeductionAmount > 0) {
      const billingTxService = new BillingTransactionService(
        tx as unknown as typeof prisma
      )
      const idempotencyKey = `manual-repair-overage:${orgIdArg}:${monthArg}:${targetUnbilledLedgers.length}-msgs`

      const mutationResult = await billingTxService.debitServiceBalance(
        {
          organizationId: orgIdArg,
          amount: new Prisma.Decimal(totalDeductionAmount),
          currency: billingAccount.currency,
          source: "WHATSAPP",
          reason: `WhatsApp overage charge reconciliation (${monthArg}: ${targetUnbilledLedgers.length} messages)`,
          idempotencyKey,
          metadata: {
            deviceId: device.id,
            reconciledLedgerCount: targetUnbilledLedgers.length,
            period: monthArg,
          },
          line: {
            description: `WhatsApp overage charge (${monthArg}: ${targetUnbilledLedgers.length} messages)`,
            quantity: new Prisma.Decimal(targetUnbilledLedgers.length),
            unitPrice: new Prisma.Decimal(defaultUtilityPrice),
            lineType: "USAGE",
            category: "whatsapp",
          },
        },
        tx as unknown as typeof prisma
      )

      console.log(`   ✅ Balance debited successfully:`)
      console.log(`      - Adjustment ID : ${mutationResult.adjustmentId}`)
      console.log(
        `      - Balance Before: ${mutationResult.currency} ${Number(mutationResult.balanceBefore).toLocaleString("id-ID")}`
      )
      console.log(
        `      - Balance After : ${mutationResult.currency} ${Number(mutationResult.balanceAfter).toLocaleString("id-ID")}`
      )
    }
  })

  console.log("\n✨ ALL REPAIRS APPLIED SUCCESSFULLY!")
}

main()
  .catch((err) => {
    console.error("\n❌ Execution failed with error:", err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
