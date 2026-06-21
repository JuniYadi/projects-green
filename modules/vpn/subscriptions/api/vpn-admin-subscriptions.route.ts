import { Elysia } from "elysia"

import { prisma } from "@/lib/prisma"
import { logProvisioningEvent } from "@/lib/audit.service"
import {
  requireSuperAdmin,
  type AdminActorContext,
  type AdminApiError,
} from "@/modules/admin/api/admin.guards"
import { VpnProvisioningJob } from "@/lib/queue/vpn-provisioning"

import {
  VpnSubscriptionService,
  vpnSubscriptionService,
} from "../vpn-subscription.service"
import { toVpnSubscriptionDTO } from "../vpn-subscription.dto"

type RouteSet = { status?: number | string }

type Deps = {
  requireSuperAdmin?: typeof requireSuperAdmin
  service?: VpnSubscriptionService
  dispatch?: (serverAccountId: string) => Promise<void>
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
  const dispatch =
    deps.dispatch ?? ((id: string) => VpnProvisioningJob.dispatch(id))
  const revokeAccount = deps.revokeAccount ?? defaultRevoke

  return new Elysia()
    .get("/admin/vpn/subscriptions", async ({ set }) => {
      const actor = await guard(set)
      if ("ok" in actor && !actor.ok) return actor as AdminApiError
      const subs = await service.listAll()
      return { ok: true, data: subs.map(toVpnSubscriptionDTO) }
    })
    .get("/admin/vpn/subscriptions/:id", async ({ params, set }) => {
      const actor = await guard(set)
      if ("ok" in actor && !actor.ok) return actor as AdminApiError
      const sub = await service.getById(params.id)
      if (!sub) return notFound(set)
      return { ok: true, data: toVpnSubscriptionDTO(sub) }
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
        await dispatch(account.id)

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
          await dispatch(account.id)

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
}
