import { Elysia } from "elysia"

import { createAdminVpnRegionsRoutes } from "./vpn-regions.route"
import { createAdminVpnPackagesRoutes } from "./vpn-packages.route"
import { createAdminVpnServersRoutes } from "./vpn-servers.route"
import { createAdminVpnSshKeysRoutes } from "./vpn-ssh-keys.route"

/**
 * Super-admin VPN management routes (regions, servers, SSH keys, packages).
 * Mounted under the global API in `lib/api.ts`.
 */
export const adminVpnRoutes = new Elysia()
  .use(createAdminVpnRegionsRoutes())
  .use(createAdminVpnSshKeysRoutes())
  .use(createAdminVpnServersRoutes())
  .use(createAdminVpnPackagesRoutes())
