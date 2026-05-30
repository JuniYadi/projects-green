import { Elysia } from "elysia"

import { createBillingAccountRoutes } from "./account.route"
import { createBillingTopupRoutes } from "./topup.route"
import { createBillingSubscriptionsRoutes } from "./subscriptions.route"
import { createBillingInvoicesRoutes } from "./invoices.route"
import { createAdminBillingRoutes } from "./admin/adjust.route"
import { createAdminAdjustmentsRoutes } from "./admin/adjustments.route"
import { createAdminSubscriptionRoutes } from "./admin/subscriptions.route"
import { createAdminMembersRoutes } from "./admin/members.route"

export const billingRoutes = new Elysia({ prefix: "/billing" })
  .use(createBillingAccountRoutes())
  .use(createBillingTopupRoutes())
  .use(createBillingSubscriptionsRoutes())
  .use(createBillingInvoicesRoutes())
  .use(createAdminBillingRoutes())
  .use(createAdminAdjustmentsRoutes())
  .use(createAdminSubscriptionRoutes())
  .use(createAdminMembersRoutes())