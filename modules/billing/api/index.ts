import { Elysia } from "elysia"

import { createAdminAuditLogRoutes } from "./admin/audit-log.route"
import { createBillingAccountRoutes } from "./account.route"
import { createBillingRoutes } from "./billing.route"
import { createBillingTopupRoutes } from "./topup.route"
import { createBillingSubscriptionsRoutes } from "./subscriptions.route"
import { createLifecycleRoutes } from "./lifecycle.route"
import { createBillingInvoicesRoutes } from "./invoices.route"
import { createAdminBillingRoutes } from "./admin/adjust.route"
import { createAdminAdjustmentsRoutes } from "./admin/adjustments.route"
import { createAdminSubscriptionRoutes } from "./admin/subscriptions.route"
import { createAdminMembersRoutes } from "./admin/members.route"
import { createAdminInvoiceRoutes } from "./admin/invoice.route"
import { createAdminInvoicesListRoutes } from "./admin/invoices-list.route"
import { createAdminUsageRoutes } from "./admin/usage.route"
import { createUsageRoutes } from "./usage.route"
import { createAdminStatsRoutes } from "./admin/stats.route"
import { createCatalogRoutes } from "./catalog.route"
import { createAdminTopupRoutes } from "./admin/topup.route"
import { createAdminOrgsRoutes } from "./admin/orgs.route"
import { createAdminPricingRoutes } from "./admin/pricing.route"
import { createAdminOrdersRoutes } from "./admin/orders.route"
import { createAdminOrgDetailRoutes } from "./admin/org-detail.route"
import { createAdminAddonsRoutes } from "./admin/addons.route"
import { createAdminCatalogRoutes } from "./admin/catalog.route"
import { createAdminPromotionsRoutes } from "./admin/promotions.route"
import { createAdminBillingContactsRoutes } from "./admin/contacts.route"
import { createBillingCheckoutRoutes } from "./checkout.route"
import { UsageLedgerService } from "../usage-ledger.service"
import { CostingService } from "../costing.service"
import { prisma } from "@/lib/prisma"

const usageLedgerService = new UsageLedgerService(prisma)
const costingService = new CostingService(prisma)

export const billingRoutes = new Elysia({ prefix: "/billing" })
  .use(createBillingAccountRoutes())
  .use(createBillingRoutes())
  .use(createBillingTopupRoutes())
  .use(createBillingSubscriptionsRoutes())
  .use(createLifecycleRoutes())
  .use(createBillingInvoicesRoutes())
  .use(createAdminBillingRoutes())
  .use(createAdminAdjustmentsRoutes())
  .use(createAdminSubscriptionRoutes())
  .use(createAdminMembersRoutes())
  .use(createAdminInvoiceRoutes())
  .use(createAdminInvoicesListRoutes())
  .use(createAdminUsageRoutes())
  .use(createUsageRoutes({ usageLedgerService, costingService }))
  .use(createAdminStatsRoutes())
  .use(createAdminTopupRoutes())
  .use(createAdminOrgsRoutes())
  .use(createAdminPricingRoutes())
  .use(createAdminOrdersRoutes())
  .use(createAdminOrgDetailRoutes())
  .use(createAdminBillingContactsRoutes())
  .use(createBillingCheckoutRoutes())
  .use(createAdminCatalogRoutes())
  .use(createAdminAddonsRoutes())
  .use(createAdminPromotionsRoutes())
  .use(createCatalogRoutes())
  .use(createAdminAuditLogRoutes())
