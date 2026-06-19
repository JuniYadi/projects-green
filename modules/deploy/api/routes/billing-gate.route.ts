import { Prisma } from "@prisma/client"
import { Elysia, t } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { prisma } from "@/lib/prisma"
import { AppHostingBillingService } from "../../billing/app-hosting-billing.service"
import { BillingTransactionService } from "@/modules/billing/billing-transaction.service"

/**
 * PGREEN-069 — Billing Gate
 *
 * Read-only billing summary for the deploy console. Computes the PAYG
 * required balance (hourlyCost × buffer, min 24h) and reports whether the
 * organization balance covers it, so `/console/app/deploy` can show the
 * gate summary and top-up guidance before a deployment is triggered.
 *
 * This complements the hard enforcement in deploy-trigger.route.ts — the
 * trigger route remains the authoritative gate; this route is for
 * pre-deploy visibility (use case 12).
 */
export const billingGateRoutes = new Elysia({
  prefix: "/deploy/billing-gate",
}).post(
  "/quote",
  async ({ body, set }) => {
    const auth = await withAuth()
    if (!auth.user) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
    }

    if (!auth.organizationId) {
      set.status = 403
      return { ok: false, error: "FORBIDDEN", message: "Organization required" }
    }

    if (body.billingMode !== "PAYG") {
      // Non-PAYG modes have no runtime-buffer gate in the MVP.
      return {
        ok: true,
        data: {
          billingMode: body.billingMode,
          gateApplies: false,
          sufficient: true,
        },
      }
    }

    if (!Number.isFinite(body.hourlyCost) || body.hourlyCost <= 0) {
      set.status = 422
      return {
        ok: false,
        error: "INVALID_HOURLY_COST",
        message:
          "A positive hourly cost is required to compute the billing gate.",
      }
    }

    const account = await prisma.billingAccount.findUnique({
      where: { organizationId: auth.organizationId },
    })
    if (!account) {
      set.status = 402
      return {
        ok: false,
        error: "BILLING_ACCOUNT_NOT_FOUND",
        message: "No billing account found for this organization.",
        topupUrl: "/console/billing/topup",
      }
    }

    const transactions = new BillingTransactionService(prisma)
    const billingService = new AppHostingBillingService(prisma, transactions)

    const quote = await billingService.quotePayg({
      organizationId: auth.organizationId,
      hourlyCost: new Prisma.Decimal(String(body.hourlyCost)),
      bufferHours: body.paygBufferHours,
    })

    const sufficient = account.balance.gte(quote.requiredBalance)
    const shortfall = sufficient
      ? new Prisma.Decimal(0)
      : quote.requiredBalance.minus(account.balance)

    return {
      ok: true,
      data: {
        billingMode: "PAYG" as const,
        gateApplies: true,
        currency: quote.currency,
        hourlyCost: quote.hourlyCost.toString(),
        bufferHours: quote.bufferHours,
        requiredBalance: quote.requiredBalance.toString(),
        currentBalance: account.balance.toString(),
        shortfall: shortfall.toString(),
        sufficient,
        topupUrl: sufficient ? null : "/console/billing/topup",
      },
    }
  },
  {
    body: t.Object({
      billingMode: t.Union([t.Literal("PAYG"), t.Literal("PACKAGE")]),
      hourlyCost: t.Number(),
      paygBufferHours: t.Optional(t.Number()),
    }),
  }
)
