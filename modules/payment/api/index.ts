import { Elysia } from "elysia"

import { createAdminBankRoutes } from "./admin-bank.route"
import { createAdminConfirmationRoutes } from "./admin-confirmation.route"
import { createAdminGatewayRoutes } from "./admin-gateway.route"
import { createConfirmRoutes } from "./confirm.route"
import { createTopupRoutes, createPaymentHistoryRoutes } from "./topup.route"

export const paymentRoutes = new Elysia({ prefix: "/portal/payments" })
  .use(createAdminBankRoutes())
  .use(createAdminGatewayRoutes())
  .use(createAdminConfirmationRoutes())

export const userPaymentRoutes = new Elysia({ prefix: "/payments" })
  .use(createTopupRoutes())
  .use(createPaymentHistoryRoutes())
  .use(createConfirmRoutes())