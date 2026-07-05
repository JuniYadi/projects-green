import { Elysia } from "elysia"

import { createAdminAuditLogRoutes } from "./admin/audit-log.route"
import { createBillingAccountRoutes } from "./account.route"
import { createBillingRoutes } from "./billing.route"
import { createBillingTopupRoutes } from "./topup.route"
import { createBillingSubscriptionsRoutes } from "./subscriptions.route"
import { createBillingInvoicesRoutes } from "./invoices.route"
import { createAdminBillingRoutes } from "./admin/adjust.route"
import { createAdminAdjustmentsRoutes } from "./admin/adjustments.route"
import { createAdminSubscriptionRoutes } from "./admin/subscriptions.route"
import { createAdminMembersRoutes } from "./admin/members.route"
import { createAdminInvoiceRoutes } from "./admin/invoice.route"
import { createAdminInvoicesListRoutes } from "./admin/invoices-list.route"
import { createAdminUsageRoutes } from "./admin/usage.route"
import { createAdminStatsRoutes } from "./admin/stats.route"
import { createAdminTopupRoutes } from "./admin/topup.route"
import { createAdminOrgsRoutes } from "./admin/orgs.route"
import { createAdminOrgDetailRoutes } from "./admin/org-detail.route"
import { createAdminBillingContactsRoutes } from "./admin/contacts.route"
import { createUsageRoutes } from "./usage.route"
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
  .use(createBillingInvoicesRoutes())
  .use(createAdminBillingRoutes())
  .use(createAdminAdjustmentsRoutes())
  .use(createAdminSubscriptionRoutes())
  .use(createAdminMembersRoutes())
  .use(createAdminInvoiceRoutes())
  .use(createAdminInvoicesListRoutes())
  .use(createAdminUsageRoutes())
  .use(createAdminStatsRoutes())
  .use(createAdminTopupRoutes())
  .use(createAdminOrgsRoutes())
  .use(createAdminOrgDetailRoutes())
  .use(createAdminBillingContactsRoutes())
  .use(createUsageRoutes({ usageLedgerService, costingService }))
  .use(createAdminAuditLogRoutes())
