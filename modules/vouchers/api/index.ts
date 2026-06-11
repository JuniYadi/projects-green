import { Elysia } from "elysia"

import { createPortalVoucherRoutes } from "./portal-vouchers.route"
import { createConsoleVoucherRoutes } from "./console-vouchers.route"

export const voucherRoutes = new Elysia()
  .use(createPortalVoucherRoutes())
  .use(createConsoleVoucherRoutes())
