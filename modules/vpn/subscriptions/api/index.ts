import { Elysia } from "elysia"

import { createVpnSubscriptionRoutes } from "./vpn-subscriptions.route"
import { createAdminVpnSubscriptionsRoutes } from "./vpn-admin-subscriptions.route"

/** Console (org-scoped) VPN subscription + purchase routes. */
export const vpnSubscriptionRoutes = new Elysia().use(
  createVpnSubscriptionRoutes()
)

/** Super-admin (all-org) VPN subscription routes. */
export const adminVpnSubscriptionRoutes = new Elysia().use(
  createAdminVpnSubscriptionsRoutes()
)
