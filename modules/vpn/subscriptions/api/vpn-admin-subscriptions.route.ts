import { Elysia } from "elysia"
import { createWorkOS } from "@workos-inc/node"

import { prisma } from "@/lib/prisma"
import { logProvisioningEvent } from "@/lib/audit.service"
import {
  requireSuperAdmin,
  type AdminActorContext,
  type AdminApiError,
} from "@/modules/admin/api/admin.guards"
import { VpnProvisioningJob } from "@/lib/queue/vpn-provisioning"
import { decryptVpnConfig } from "@/modules/vpn/vpn-crypto"
import { vpnProvisioningService } from "@/modules/vpn/provisioning/vpn-provisioning.service"

import {
  VpnSubscriptionService,
  buildAccountUsername,
  vpnSubscriptionService,
  type VpnSubscriptionWithAccounts,
} from "../vpn-subscription.service"
import { toVpnSubscriptionDTO } from "../vpn-subscription.dto"

type RouteSet = { status?: number | string }

type Deps = {
  requireSuperAdmin?: typeof requireSuperAdmin
  service?: VpnSubscriptionService
  revokeAccount?: (serverAccountId: string) => Promise<void>
}

const defaultRevoke = async (serverAccountId: string) => {
  await prisma.vpnServerAccount.update({
    where: { id: serverAccountId },
    data: { provisioningStatus: "REVOKED", failureReason: null },
  })
}

const notFound = (set: RouteSet): AdminApiError => {
  set.status = 404
  return { ok: false, error: "NOT_FOUND", message: "Subscription not found." }
}

export const createAdminVpnSubscriptionsRoutes = (deps: Deps = {}) => {
  const guard = deps.requireSuperAdmin ?? requireSuperAdmin
  const service = deps.service ?? vpnSubscriptionService
  const revokeAccount = deps.revokeAccount ?? defaultRevoke

  return new Elysia()
    .get("/admin/vpn/subscriptions", async ({ set }) => {
      const actor = await guard(set)
      if ("ok" in actor && !actor.ok) return actor as AdminApiError
      const subs = await service.listAll()

      // Resolve organization names from WorkOS (parallel fetch)
      const workos = createWorkOS({ apiKey: process.env.WORKOS_API_KEY ?? "" })
      const uniqueOrgIds = [...new Set(subs.map((s) => s.organizationId))]
      const results = await Promise.all(
        uniqueOrgIds.map(async (id) => {
          try {
            const org = await workos.organizations.getOrganization(id)
            return { id, name: org.name } as const
          } catch (err) {
            console.error(`Failed to fetch org ${id}:`, err)
            return { id, name: id } as const
          }
        })
      )
      const orgNames = new Map(results.map((r) => [r.id, r.name]))

      // Resolve package names from database
      const uniquePackageIds = [...new Set(subs.map((s) => s.packageId))]
      const packages = await prisma.vpnPackage.findMany({
        where: { id: { in: uniquePackageIds } },
        select: { id: true, name: true },
      })
      const packageNames = new Map(packages.map((p) => [p.id, p.name]))

      return {
        ok: true,
        data: subs.map((s: VpnSubscriptionWithAccounts) =>
          toVpnSubscriptionDTO(
            s,
            orgNames.get(s.organizationId) ?? null,
            packageNames.get(s.packageId) ?? null
          )
        ),
      }
    })
    .get("/admin/vpn/subscriptions/:id", async ({ params, set }) => {
      const actor = await guard(set)
      if ("ok" in actor && !actor.ok) return actor as AdminApiError
      const sub = await service.getById(params.id)
      if (!sub) return notFound(set)

      // Resolve organization name from WorkOS
      const workos = createWorkOS({ apiKey: process.env.WORKOS_API_KEY ?? "" })
      let orgName: string | null = null
      try {
        const org = await workos.organizations.getOrganization(sub.organizationId)
        orgName = org.name
      } catch (err) {
        console.error(`Failed to fetch org ${sub.organizationId}:`, err)
      }

      // Resolve package name from database
      const pkg = await prisma.vpnPackage.findUnique({
        where: { id: sub.packageId },
        select: { name: true },
      })

      return { ok: true, data: toVpnSubscriptionDTO(sub, orgName, pkg?.name ?? null) }
    })
    .post(
      "/admin/vpn/subscriptions/:id/servers/:saId/retry",
      async ({ params, set }) => {
        const actor = (await guard(set)) as AdminActorContext | AdminApiError
        if (!actor.ok) return actor
        const sub = await service.getById(params.id)
        const account = sub?.serverAccounts.find((a) => a.id === params.saId)
        if (!sub || !account) return notFound(set)

        const previousFailureReason = account.failureReason ?? "Unknown"
        await prisma.vpnServerAccount.update({
          where: { id: account.id },
          data: { provisioningStatus: "PENDING", failureReason: null },
        })
        // ponytail: no jobId — dispatch uses fixed jobId that silently dedup's,
        // so a retry would never enqueue a second time.
        await VpnProvisioningJob.enqueue({ serverAccountId: account.id })

        logProvisioningEvent({
          action: "PROVISIONING_RETRIED",
          serverAccountId: account.id,
          details: {
            serverAccountId: account.id,
            previousFailureReason,
            triggeredByAdminId: actor.userId,
          },
          adminId: actor.userId,
        })

        return { ok: true }
      }
    )
    .post(
      "/admin/vpn/subscriptions/:id/servers/:saId/validate",
      async ({ params, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError
        const sub = await service.getById(params.id)
        const account = sub?.serverAccounts.find((a) => a.id === params.saId)
        if (!sub || !account) return notFound(set)

        const validation = await vpnProvisioningService.validateAccount(account.id)
        return { ok: true, data: validation }
      }
    )
    .post(
      "/admin/vpn/subscriptions/:id/servers/:saId/recreate",
      async ({ params, set }) => {
        const actor = (await guard(set)) as AdminActorContext | AdminApiError
        if (!actor.ok) return actor
        const sub = await service.getById(params.id)
        const account = sub?.serverAccounts.find((a) => a.id === params.saId)
        if (!sub || !account) return notFound(set)

        const previousUsername = account.username
        const username = buildAccountUsername(
          sub.organizationId,
          account.serverId,
          account.protocol
        )

        await prisma.vpnServerAccount.update({
          where: { id: account.id },
          data: {
            username,
            provisioningStatus: "PENDING",
            failureReason: null,
            configEncrypted: null,
            password: null,
          },
        })
        await VpnProvisioningJob.enqueue({ serverAccountId: account.id })

        logProvisioningEvent({
          action: "PROVISIONING_RECREATE_REQUESTED",
          serverAccountId: account.id,
          details: {
            serverAccountId: account.id,
            previousUsername,
            username,
            triggeredByAdminId: actor.userId,
          },
          adminId: actor.userId,
        })

        return { ok: true }
      }
    )
    .post(
      "/admin/vpn/subscriptions/:id/servers/:saId/revoke",
      async ({ params, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError
        const sub = await service.getById(params.id)
        const account = sub?.serverAccounts.find((a) => a.id === params.saId)
        if (!sub || !account) return notFound(set)
        await revokeAccount(account.id)
        return { ok: true }
      }
    )
    .post(
      "/admin/vpn/subscriptions/:id/retry-all",
      async ({ params, set }) => {
        const actor = (await guard(set)) as AdminActorContext | AdminApiError
        if (!actor.ok) return actor

        const failedAccounts = await prisma.vpnServerAccount.findMany({
          where: {
            subscriptionId: params.id,
            provisioningStatus: "FAILED",
          },
        })

        for (const account of failedAccounts) {
          await prisma.vpnServerAccount.update({
            where: { id: account.id },
            data: { provisioningStatus: "PENDING", failureReason: null },
          })
          await VpnProvisioningJob.enqueue({ serverAccountId: account.id })

          logProvisioningEvent({
            action: "PROVISIONING_RETRIED",
            serverAccountId: account.id,
            details: {
              serverAccountId: account.id,
              previousFailureReason: account.failureReason ?? "Unknown",
              triggeredByAdminId: actor.userId,
            },
            adminId: actor.userId,
          })
        }

        return { ok: true, retried: failedAccounts.length }
      }
    )
    .get(
      "/admin/vpn/subscriptions/:id/servers/:saId/config",
      async ({ params, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        const account = await prisma.vpnServerAccount.findUnique({
          where: { id: params.saId },
          select: { id: true, subscriptionId: true, configEncrypted: true },
        })

        if (!account || account.subscriptionId !== params.id) {
          return notFound(set)
        }

        if (!account.configEncrypted) {
          set.status = 404
          return {
            ok: false,
            error: "CONFIG_NOT_FOUND",
            message: "Config not available for this account.",
          }
        }

        const plainConfig = decryptVpnConfig(account.configEncrypted)

        set.status = 200
        set.headers = {
          "Content-Type": "application/x-openvpn-profile",
          "Content-Disposition": `attachment; filename="${params.saId}.ovpn"`,
        }

        return plainConfig
      }
    )
}
