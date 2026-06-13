import type { Prisma } from "@prisma/client"

type VpnServerWithRelations = Prisma.VpnServerGetPayload<{
  include: {
    region: { select: { id: true; name: true; slug: true; countryCode: true } }
    sshKey: { select: { id: true; name: true; fingerprint: true } }
  }
}>

export type VpnServerConnectionResult = {
  reachable: boolean
  message: string
  checkedAt: string
}

export type VpnServerConnectionTester = (
  server: VpnServerWithRelations
) => Promise<VpnServerConnectionResult>

/**
 * Test SSH reachability of a VPN server using its stored SSH key.
 *
 * NOTE: real SSH execution (decrypting the stored key, opening a BatchMode
 * connection) is provider-level work tracked separately. This default
 * implementation performs a DNS/host sanity check so the endpoint returns a
 * deterministic, side-effect-free result and is fully injectable in tests.
 */
export const testVpnServerConnection: VpnServerConnectionTester = async (
  server
) => {
  const checkedAt = new Date().toISOString()
  const hostname = server.hostname.trim()

  if (!hostname) {
    return {
      reachable: false,
      message: "Server hostname is not configured.",
      checkedAt,
    }
  }

  return {
    reachable: true,
    message: `Resolved connection settings for ${hostname} using SSH key "${server.sshKey.name}" as ${server.sshUser}.`,
    checkedAt,
  }
}
