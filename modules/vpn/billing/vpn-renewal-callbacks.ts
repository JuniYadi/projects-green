import type { PrismaClient } from "@prisma/client"
import type { RenewalServiceCallbacks } from "@/modules/billing/renewal/renewal-coordinator.service"
import { vpnProvisioningService } from "@/modules/vpn/provisioning/vpn-provisioning.service"
import {
  vpnEmailService,
  type VpnEmailService,
} from "@/modules/vpn/email.service"

/**
 * VPN provisioning side effects for the global renewal ladder.
 * Commercial status lives on ServiceSubscription and is written by the
 * coordinator; this file touches only the VpnSubscription satellite and
 * the resources it owns.
 */
export function createVpnRenewalCallbacks(
  prisma: PrismaClient,
  emailService: VpnEmailService = vpnEmailService
): RenewalServiceCallbacks {
  async function satellite(serviceSubscriptionId: string) {
    return prisma.vpnSubscription.findFirst({
      where: { serviceSubscriptionId },
      select: {
        id: true,
        organizationId: true,
        serverAccounts: { select: { id: true } },
      },
    })
  }

  return {
    async onSuspend(serviceSubscriptionId) {
      const vpn = await satellite(serviceSubscriptionId)
      if (!vpn) return

      await prisma.vpnMobileDevice.updateMany({
        where: { subscriptionId: vpn.id, status: "ACTIVE" },
        data: { status: "SUSPENDED" },
      })
      await prisma.vpnSubscription.update({
        where: { id: vpn.id },
        data: { status: "SUSPENDED" },
      })

      // Best-effort, matching the retired applyGrace: a mail failure must not
      // roll the customer back to ACTIVE on the coordinator's next run.
      emailService.sendSubscriptionSuspended(vpn.organizationId).catch(() => {})
    },

    async onTerminate(serviceSubscriptionId) {
      const vpn = await satellite(serviceSubscriptionId)
      if (!vpn) return

      // Not allSettled: a failed cert removal must reach the coordinator so
      // it retries next run instead of recording a termination that left
      // working credentials on the server.
      for (const account of vpn.serverAccounts) {
        await vpnProvisioningService.removeRemoteAccount(account.id)
      }

      await prisma.vpnMobileDevice.updateMany({
        where: {
          subscriptionId: vpn.id,
          status: { in: ["ACTIVE", "SUSPENDED"] },
        },
        data: {
          status: "REVOKED",
          revokedAt: new Date(),
          revokedReason: "subscription terminated",
        },
      })
      await prisma.vpnSubscription.update({
        where: { id: vpn.id },
        data: { status: "EXPIRED" },
      })

      emailService.sendSubscriptionExpired(vpn.organizationId).catch(() => {})
    },
  }
}
