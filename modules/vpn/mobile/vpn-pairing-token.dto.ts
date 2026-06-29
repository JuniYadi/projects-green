import type { Prisma } from "@prisma/client"

/**
 * Result of generate() — the JWT, its ISO expiry, and the QR payload string.
 * qrPayload === pairingToken in Phase 1 (app encodes the raw JWT as a QR).
 */
export type PairingGenerateResultDTO = {
  pairingToken: string
  expiresAt: string
  qrPayload: string
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type SubscriptionRow = Prisma.VpnSubscriptionGetPayload<{}>
type ServerAccountRow = Prisma.VpnServerAccountGetPayload<{
  include: {
    server: {
      select: { name: true; hostname: true; ipAddress: true; region: { select: { name: true } } }
    }
  }
}>

/**
 * Subscription slice embedded in the claim response.
 */
export type PairingClaimSubscriptionDTO = {
  id: string
  status: SubscriptionRow["status"]
  currentPeriodEnd: string
}

/**
 * VPN profile entry embedded in the claim response. Derived from
 * VpnServerAccount via Prisma Pick<...>.
 */
export type PairingClaimProfileDTO = {
  id: string
  serverName: string
  hostname: string
  serverIp: string | null
  protocol: ServerAccountRow["protocol"]
  region: string
  status: ServerAccountRow["provisioningStatus"]
}

/**
 * Result of claim() — device id + the subscription + profiles to provision.
 */
export type PairingClaimResultDTO = {
  deviceId: string
  token: string
  expiresAt: string
  subscription: PairingClaimSubscriptionDTO
  profiles: PairingClaimProfileDTO[]
}

/**
 * Map a VpnSubscription row + VpnServerAccount rows into the claim response
 * DTO.
 */
export function toPairingClaimResultDTO(
  deviceId: string,
  subscription: SubscriptionRow,
  accounts: ServerAccountRow[],
  session: { token: string; expiresAt: string }
): PairingClaimResultDTO {
  return {
    deviceId,
    token: session.token,
    expiresAt: session.expiresAt,
    subscription: {
      id: subscription.id,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
    },
    profiles: accounts.map((account) => ({
      id: account.id,
      serverName: account.server.name,
      hostname: account.server.hostname,
      serverIp: account.server.ipAddress,
      protocol: account.protocol,
      region: account.server.region.name,
      status: account.provisioningStatus,
    })),
  }
}

/**
 * Map a generate() JWT + ISO expiry into the generate response DTO.
 */
export function toPairingGenerateResultDTO(
  pairingToken: string,
  expiresAt: Date
): PairingGenerateResultDTO {
  return {
    pairingToken,
    expiresAt: expiresAt.toISOString(),
    qrPayload: pairingToken,
  }
}
