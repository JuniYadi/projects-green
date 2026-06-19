import { Elysia } from "elysia"

import { createAdminBankRoutes } from "./admin-bank.route"
import { createAdminConfirmationRoutes } from "./admin-confirmation.route"
import { createAdminCurrencyRoutes } from "./admin-currency.route"
import { createAdminGatewayRoutes } from "./admin-gateway.route"
import { createAdminSettingsRoutes } from "./admin-settings.route"
import { createConfirmRoutes } from "./confirm.route"
import { createInvoicePaymentRoutes } from "./invoice-payment.route"
import { createTopupRoutes, createPaymentHistoryRoutes } from "./topup.route"
import { createUserBankAccountRoutes } from "./user-bank-account.route"
import { createUploadScreenshotRoutes } from "./upload-screenshot.route"
import { createWebhookRoutes } from "./webhook.route"

export const paymentRoutes = new Elysia({ prefix: "/portal/payments" })
  .use(createAdminBankRoutes())
  .use(createAdminGatewayRoutes())
  .use(createAdminCurrencyRoutes())
  .use(createAdminConfirmationRoutes())
  .use(createAdminSettingsRoutes())

export const userPaymentRoutes = new Elysia({ prefix: "/payments" })
  .use(createTopupRoutes())
  .use(createPaymentHistoryRoutes())
  .use(createConfirmRoutes())
  .use(createInvoicePaymentRoutes())
  .use(createUserBankAccountRoutes())
  .use(createUploadScreenshotRoutes())

export const webhookRoutes = new Elysia({ prefix: "/webhooks" }).use(
  createWebhookRoutes()
)
