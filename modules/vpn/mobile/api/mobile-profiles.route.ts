/**
 * Mobile profile delivery routes (T4.1-T4.3).
 *
 * GET  /api/vpn/mobile/profiles — List available VPN profiles for the authenticated device.
 * GET  /api/vpn/mobile/profiles/:profileId/config — Download decrypted VPN config file.
 * POST /api/vpn/mobile/profiles/:profileId/heartbeat — Send periodic heartbeat.
 */

import { Elysia, t } from "elysia"

import { prisma } from "@/lib/prisma"

import {
  requireMobileSession,
  type MobileAuthContext,
} from "./mobile-auth.middleware"

type RouteSet = { status?: number | string }

/**
 * Helper to check if a device is allowed to access profiles.
 * Returns the device record or null (with set.status set).
 */
async function checkDeviceAccess(
  mobileAuth: MobileAuthContext,
  set: RouteSet
): Promise<{
  device: { id: string; status: string; subscriptionId: string }
  subscription: { id: string; status: string }
} | null> {
  const device = await prisma.vpnMobileDevice.findUnique({
    where: { id: mobileAuth.deviceId },
    select: { id: true, status: true, subscriptionId: true },
  })

  if (!device || device.status === "REVOKED") {
    set.status = 403
    return null
  }

  const subscription = await prisma.vpnSubscription.findUnique({
    where: { id: device.subscriptionId },
    select: { id: true, status: true },
  })

  if (
    !subscription ||
    (subscription.status !== "ACTIVE" && subscription.status !== "SUSPENDED")
  ) {
    set.status = 403
    return null
  }

  return { device, subscription }
}

export const createMobileProfilesRoutes = () => {
  return new Elysia()

    /**
     * List available VPN profiles for the authenticated device.
     */
    .get(
      "/vpn/mobile/profiles",
      async ({ request, set }) => {
        const auth = await requireMobileSession(request, set)
        if (!auth.ok) return auth.error

        const access = await checkDeviceAccess(auth.mobileAuth, set)
        if (!access) {
          const device = await prisma.vpnMobileDevice.findUnique({
            where: { id: auth.mobileAuth.deviceId },
            select: { status: true },
          })
          if (device?.status === "REVOKED") {
            return {
              error: {
                code: "DEVICE_REVOKED",
                message: "This device has been revoked and cannot access VPN services.",
                details: { deviceId: auth.mobileAuth.deviceId },
              },
            }
          }
          return {
            error: {
              code: "SUBSCRIPTION_EXPIRED",
              message: "Your subscription is no longer active.",
              details: {},
            },
          }
        }

        const accounts = await prisma.vpnServerAccount.findMany({
          where: { subscriptionId: access.device.subscriptionId },
          include: {
            server: {
              select: { id: true, name: true, hostname: true, region: { select: { name: true } } },
            },
          },
          orderBy: { server: { name: "asc" } },
        })

        return {
          profiles: accounts.map((account) => ({
            id: account.id,
            serverId: account.server.id,
            serverName: account.server.name,
            hostname: account.server.hostname,
            protocol: account.protocol,
            region: account.server.region.name,
            provisioningStatus: account.provisioningStatus,
          })),
        }
      }
    )

    /**
     * Download decrypted VPN config file.
     */
    .get(
      "/vpn/mobile/profiles/:profileId/config",
      async ({ request, params, set }) => {
        const auth = await requireMobileSession(request, set)
        if (!auth.ok) return auth.error

        const access = await checkDeviceAccess(auth.mobileAuth, set)
        if (!access) {
          return {
            error: {
              code: "DEVICE_REVOKED",
              message: "This device has been revoked and cannot access VPN services.",
              details: { deviceId: auth.mobileAuth.deviceId },
            },
          }
        }

        const account = await prisma.vpnServerAccount.findUnique({
          where: { id: params.profileId },
          select: { id: true, subscriptionId: true, configEncrypted: true, protocol: true },
        })

        if (!account || account.subscriptionId !== access.device.subscriptionId) {
          set.status = 404
          return {
            error: { code: "NOT_FOUND", message: "Profile not found.", details: {} },
          }
        }

        if (!account.configEncrypted) {
          set.status = 500
          return {
            error: {
              code: "CONFIG_DECRYPT_FAILED",
              message: "No configuration available for this profile.",
              details: {},
            },
          }
        }

        let config: string
        try {
          const { decryptVpnConfig } = await import("@/modules/vpn/vpn-crypto")
          config = decryptVpnConfig(account.configEncrypted)
        } catch {
          set.status = 500
          return {
            error: {
              code: "CONFIG_DECRYPT_FAILED",
              message: "Failed to decrypt VPN configuration.",
              details: {},
            },
          }
        }

        const format = account.protocol === "WIREGUARD" ? "wireguard" : account.protocol === "OPENVPN" ? "openvpn" : "proxy"

        return { config, format, profileId: account.id }
      }
    )

    /**
     * Send periodic heartbeat from mobile app (updates lastSeenAt).
     */
    .post(
      "/vpn/mobile/profiles/:profileId/heartbeat",
      async ({ request, set }) => {
        const auth = await requireMobileSession(request, set)
        if (!auth.ok) return auth.error

        await prisma.vpnMobileDevice.update({
          where: { id: auth.mobileAuth.deviceId },
          data: { lastSeenAt: new Date() },
        })

        return { ok: true as const }
      },
      { body: t.Object({}) }
    )
}

export const mobileProfilesRoutes = createMobileProfilesRoutes()
