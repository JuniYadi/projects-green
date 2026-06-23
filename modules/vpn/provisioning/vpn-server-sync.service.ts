import { type VpnProtocol, type VpnServer } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { logAuditEvent } from "@/lib/audit.service"
import { VpnProvisioningJob } from "@/lib/queue/vpn-provisioning"
import { buildAccountUsername } from "../subscriptions/vpn-subscription.service"

// ponytail: static cap — env-config if a real use-case exceeds 100
const MAX_SUBS_PER_SYNC = 100

type EnabledProtocol = VpnProtocol

/**
 * Derive the set of enabled protocols from the server's boolean flags.
 */
function enabledProtocols(server: VpnServer): EnabledProtocol[] {
  const protocols: EnabledProtocol[] = []
  if (server.hasOpenVpn) protocols.push("OPENVPN")
  if (server.hasWireGuard) protocols.push("WIREGUARD")
  if (server.hasProxy) protocols.push("PROXY")
  return protocols
}

export type SyncSummary = {
  totalSubscriptionsChecked: number
  created: number
  skipped: number
}

/**
 * Scans ACTIVE subscriptions linked to a server and creates VpnServerAccount
 * rows for any protocols the server now supports but the subscription doesn't
 * have yet.
 */
export class VpnServerSyncService {
  async sync(
    serverId: string,
    correlationId: string
  ): Promise<SyncSummary> {
    const server = await prisma.vpnServer.findUniqueOrThrow({
      where: { id: serverId },
    })

    const enabled = enabledProtocols(server)
    if (enabled.length === 0) {
      console.info(
        `[vpn-server-sync] server=${serverId} has no protocols enabled, skipping`
      )
      return { totalSubscriptionsChecked: 0, created: 0, skipped: 0 }
    }

    await logAuditEvent({
      serverId,
      correlationId,
      action: "SYNC_PROTOCOLS_STARTED",
      status: "STARTED",
      message: `Sync protocols for server "${server.name}": ${enabled.join(", ")}`,
      details: { enabledProtocols: enabled },
    })

    // Find all packages linked to this server, then all ACTIVE subscriptions
    // for those packages. Two-step query because VpnPackage has no reverse
    // relation to VpnSubscription.
    const serverPackages = await prisma.vpnPackageServer.findMany({
      where: { serverId },
      take: MAX_SUBS_PER_SYNC,
    })

    const packageIds = [...new Set(serverPackages.map((sp) => sp.packageId))]

    const subscriptions = await prisma.vpnSubscription.findMany({
      where: { packageId: { in: packageIds }, status: "ACTIVE" },
      take: MAX_SUBS_PER_SYNC,
    })

    // Batch-fetch all existing accounts for this server + subscriptions
    const subIds = subscriptions.map((s) => s.id)
    const existingAccounts = await prisma.vpnServerAccount.findMany({
      where: { serverId, subscriptionId: { in: subIds } },
      select: { subscriptionId: true, protocol: true },
    })

    const accountsBySub = new Map<string, Set<string>>()
    for (const acct of existingAccounts) {
      const set = accountsBySub.get(acct.subscriptionId) ?? new Set()
      set.add(acct.protocol)
      accountsBySub.set(acct.subscriptionId, set)
    }

    let created = 0
    let skipped = 0
    let totalSubscriptionsChecked = 0

    for (const subscription of subscriptions) {
      totalSubscriptionsChecked++

      const existingProtocols = accountsBySub.get(subscription.id) ?? new Set()
      const missing = enabled.filter((p) => !existingProtocols.has(p))

      if (missing.length === 0) {
        skipped++
        await logAuditEvent({
          serverId,
          subscriptionId: subscription.id,
          organizationId: subscription.organizationId,
          correlationId,
          action: "SYNC_PROTOCOLS_ACCOUNT_SKIPPED",
          status: "OK",
          message: `Subscription ${subscription.id} already has all protocols (${enabled.join(", ")})`,
          details: { enabledProtocols: enabled, existingProtocols: [...existingProtocols] },
        })
        continue
      }

      for (const protocol of missing) {
        const username = buildAccountUsername(
          subscription.organizationId,
          serverId,
          protocol
        )

        const account = await prisma.vpnServerAccount.create({
          data: {
            subscriptionId: subscription.id,
            serverId,
            protocol,
            provisioningStatus: "PENDING",
            username,
          },
        })

        // ponytail: dispatch fires even if audit log write fails — order is intentional
        await VpnProvisioningJob.dispatch(account.id)
        await logAuditEvent({
          serverId,
          subscriptionId: subscription.id,
          serverAccountId: account.id,
          organizationId: subscription.organizationId,
          correlationId,
          action: "SYNC_PROTOCOLS_ACCOUNT_CREATED",
          status: "PENDING",
          message: `Created ${protocol} account "${username}" for subscription ${subscription.id}`,
          details: { protocol, username },
        })

        created++
      }
    }

    await logAuditEvent({
      serverId,
      correlationId,
      action: "SYNC_PROTOCOLS_COMPLETED",
      status: "OK",
      message: `Sync completed: ${totalSubscriptionsChecked} subs checked, ${created} created, ${skipped} skipped`,
      details: { totalSubscriptionsChecked, created, skipped },
    })

    return { totalSubscriptionsChecked, created, skipped }
  }
}

export const vpnServerSyncService = new VpnServerSyncService()
