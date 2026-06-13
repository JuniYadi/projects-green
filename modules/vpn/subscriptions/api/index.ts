import { Elysia } from "elysia"

import { createVpnSubscriptionRoutes } from "./vpn-subscriptions.route"
import { createAdminVpnSubscriptionsRoutes } from "./vpn-admin-subscriptions.route"
import { createVpnPackageCatalogRoutes } from "./vpn-packages-catalog.route"

/** Public (no-auth) VPN package catalog: listing + detail. */
export const vpnPackageCatalogRoutes = new Elysia().use(
  createVpnPackageCatalogRoutes()
)

/** Console (org-scoped) VPN subscription + purchase routes. */
export const vpnSubscriptionRoutes = new Elysia().use(
  createVpnSubscriptionRoutes()
)

/** Super-admin (all-org) VPN subscription routes. */
export const adminVpnSubscriptionRoutes = new Elysia().use(
  createAdminVpnSubscriptionsRoutes()
)
