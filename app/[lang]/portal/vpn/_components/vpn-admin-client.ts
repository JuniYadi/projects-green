"use client"

export type VpnApiError = {
  ok: false
  error: string
  message: string
}

export type ScanCheckStatus = "pass" | "fail" | "skip" | "error"
export type ScanStatus = "completed" | "partial" | "failed"

export type ScanCheckResult = {
  check: "ssh" | "openvpn" | "wireguard" | "proxy"
  label: string
  status: ScanCheckStatus
  protocol: "ssh" | "openvpn" | "wireguard" | "proxy"
  host: string | null
  port: number | null
  transport: "tcp" | "udp" | null
  latencyMs: number | null
  message: string
  detail?: string
  timestamp: string
  processName?: string
  processPid?: number
  suggestedAction?: string
}

export type ScanSummary = {
  total: number
  passed: number
  failed: number
  errors: number
  skipped: number
}

export type ScanResult = {
  status: ScanStatus
  startedAt: string
  completedAt: string
  results: ScanCheckResult[]
  summary: ScanSummary
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
  ipAddress: string | null
  sshPort: number
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

export type ProvisioningSummary = {
  active: number
  pending: number
  failed: number
  revoked: number
  total: number
}

export type VpnSubscriptionItem = {
  id: string
  organizationId: string
  organizationName: string | null
  packageId: string
  packageName: string
  status: "ACTIVE" | "SUSPENDED" | "EXPIRED"
  currentPeriodStart: string
  currentPeriodEnd: string
  deviceCount: number
  serverAccounts: VpnServerAccountEntry[]
  provisioningSummary: ProvisioningSummary
  // Multi-currency audit fields
  priceLocked: string
  currency: string
  originalPrice: string | null
  originalCurrency: string | null
  exchangeRate: number | null
  createdAt: string
  updatedAt: string
}

/**
 * Thin fetch wrapper for the admin VPN API. Throws an Error with the API
 * message on a non-ok response so callers can surface it to the user.
 */
export async function vpnApi<T>(path: string, init?: RequestInit): Promise<T> {
  // eslint-disable-next-line no-restricted-globals
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
