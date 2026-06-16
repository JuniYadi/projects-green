/**
 * VPN Mobile API assembly.
 *
 * Mounts all mobile-related routes under the /vpn/mobile prefix.
 * Imported by lib/api.ts and mounted as .use(mobileVpnRoutes).
 */

import { Elysia } from "elysia"

import { mobileAuthRoutes } from "./mobile-auth.route"
import { mobilePairingRoutes } from "./mobile-pairing.route"
import { mobileProfilesRoutes } from "./mobile-profiles.route"
import { mobileDeviceRoutes } from "./mobile-device.route"
import { adminDevicesRoutes } from "./admin-devices.route"

/**
 * Mobile VPN routes group.
 * Prefix: /vpn/mobile (appended to /api in lib/api.ts).
 *
 * Sub-routes:
 *   /vpn/mobile/auth/*
 *   /vpn/mobile/pairing/*
 *   /vpn/mobile/profiles/*
 *   /vpn/mobile/devices/*
 *   /vpn/mobile/admin/devices/*
 */
export const mobileVpnRoutes = new Elysia()
  .use(mobileAuthRoutes)
  .use(mobilePairingRoutes)
  .use(mobileProfilesRoutes)
  .use(mobileDeviceRoutes)
  .use(adminDevicesRoutes)
