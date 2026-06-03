import { Elysia } from "elysia"

import { createBillingAccountRoutes } from "./account.route"
import { createBillingTopupRoutes } from "./topup.route"
import { createBillingSubscriptionsRoutes } from "./subscriptions.route"
import { createBillingInvoicesRoutes } from "./invoices.route"
import { createAdminBillingRoutes } from "./admin/adjust.route"
import { createAdminAdjustmentsRoutes } from "./admin/adjustments.route"
import { createAdminSubscriptionRoutes } from "./admin/subscriptions.route"
import { createAdminMembersRoutes } from "./admin/members.route"
import { createAdminInvoiceRoutes } from "./admin/invoice.route"
import { createUsageRoutes } from "./usage.route"
import { UsageLedgerService } from "../usage-ledger.service"
import { CostingService } from "../costing.service"
import { prisma } from "@/lib/prisma"

const usageLedgerService = new UsageLedgerService(prisma)
const costingService = new CostingService(prisma)

export const billingRoutes = new Elysia({ prefix: "/billing" })
  .use(createBillingAccountRoutes())
  .use(createBillingTopupRoutes())
  .use(createBillingSubscriptionsRoutes())
  .use(createBillingInvoicesRoutes())
  .use(createAdminBillingRoutes())
  .use(createAdminAdjustmentsRoutes())
  .use(createAdminSubscriptionRoutes())
  .use(createAdminMembersRoutes())
  .use(createAdminInvoiceRoutes())
  .use(createUsageRoutes({ usageLedgerService, costingService }))