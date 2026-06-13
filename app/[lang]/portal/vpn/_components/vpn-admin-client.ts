"use client"

export type VpnApiError = {
  ok: false
  error: string
  message: string
}

export type VpnRegionItem = {
  id: string
  name: string
  slug: string
  countryCode: string
  isActive: boolean
  serverCount: number
  createdAt: string
  updatedAt: string
}

export type VpnSshKeyItem = {
  id: string
  name: string
  fingerprint: string
  usedByServerNames: string[]
  createdAt: string
  updatedAt: string
}

export type VpnServerItem = {
  id: string
  name: string
  hostname: string
  sshUser: string
  isActive: boolean
  health: "HEALTHY" | "WARNING" | "DOWN" | "UNKNOWN"
  region: { id: string; name: string; slug: string; countryCode: string }
  sshKey: { id: string; name: string; fingerprint: string }
  protocols: {
    openVpn: { enabled: boolean; port: number | null }
    wireGuard: { enabled: boolean; port: number | null }
    proxy: { enabled: boolean; port: number | null }
  }
  createdAt: string
  updatedAt: string
}

export type VpnPackageServerEntry = {
  id: string
  server: VpnServerItem
  protocols: string[]
}

export type VpnPackageItem = {
  id: string
  name: string
  description: string | null
  price: string
  currency: "IDR" | "USD"
  isActive: boolean
  serverCount: number
  servers: VpnPackageServerEntry[]
  createdAt: string
  updatedAt: string
}

export type VpnServerAccountEntry = {
  id: string
  serverId: string
  serverName: string
  protocol: "OPENVPN" | "WIREGUARD" | "PROXY"
  username: string
  provisioningStatus:
    | "PENDING"
    | "PROVISIONING"
    | "ACTIVE"
    | "FAILED"
    | "REVOKED"
  failureReason: string | null
  hasConfig: boolean
  hasCredentials: boolean
  createdAt: string
  updatedAt: string
}

export type VpnSubscriptionItem = {
  id: string
  organizationId: string
  packageId: string
  status: "ACTIVE" | "SUSPENDED" | "EXPIRED"
  currentPeriodStart: string
  currentPeriodEnd: string
  serverAccounts: VpnServerAccountEntry[]
  createdAt: string
  updatedAt: string
}

/**
 * Thin fetch wrapper for the admin VPN API. Throws an Error with the API
 * message on a non-ok response so callers can surface it to the user.
 */
export async function vpnApi<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  })

  const payload = (await response.json().catch(() => null)) as
    | ({ ok: true } & Record<string, unknown>)
    | VpnApiError
    | null

  if (!response.ok || !payload || payload.ok === false) {
    const message =
      payload && "message" in payload && typeof payload.message === "string"
        ? payload.message
        : `Request failed with status ${response.status}`
    throw new Error(message)
  }

  return payload as T
}
