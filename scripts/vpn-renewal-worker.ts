/**
 * VPN Renewal Worker
 *
 * Scans for ACTIVE VPN subscriptions whose current period has ended
 * and charges the next month upfront from the organization's balance.
 *
 * Idempotent: uses vpn-monthly:{subscriptionId}:{period} idempotency key
 * via VpnBillingService → BillingTransactionService. Safe to retry:
 * already-processed renewals return alreadyProcessed=true and the period
 * extension is skipped.
 *
 * MVP rules:
 *   - VPN is monthly-only — no PAYG, no grace period.
 *   - INSUFFICIENT_BALANCE → subscription is SUSPENDED immediately.
 *   - No provider teardown on suspension (future task).
 *
 * Usage: bun run scripts/vpn-renewal-worker.ts
 */

import { prisma } from "@/lib/prisma"
import { BillingTransactionService } from "@/modules/billing/billing-transaction.service"
import { VpnBillingService } from "@/modules/vpn/billing/vpn-billing.service"
import { VpnRenewalService } from "@/modules/vpn/billing/vpn-renewal.service"

async function main() {
  console.info("[vpn-renewal] Starting VPN monthly renewal cycle...")

  const transactions = new BillingTransactionService(prisma)
  const vpnBilling = new VpnBillingService(prisma, transactions)
  const renewalService = new VpnRenewalService(prisma, vpnBilling)

  const result = await renewalService.renewDueSubscriptions()

  console.info(
    `[vpn-renewal] Complete: ${result.renewed} renewed, ${result.suspended} suspended, ${result.errors} errors`,
  )

  if (result.errors > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error("[vpn-renewal] Fatal error:", err)
  process.exit(1)
})
