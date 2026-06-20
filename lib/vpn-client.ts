// VPN API client types and fetch helpers

export type VpnSubscriptionResponse = {
  ok: true
  subscriptionId: string
  organizationId: string
  regionCode: string
  planCode: string
  status: "ACTIVE"
  monthlyPrice: string
  monthlyPriceMinor: number
  currency: string
  period: string
  topupUrl: string
  vpnClientId: string
}

export type VpnClientStatus = {
  id: string
  clientName: string
  status: string
  regionCode: string
  currentPeriodStart: string
  currentPeriodEnd: string
}

export type VpnStatusResponse = {
  ok: true
  clients: VpnClientStatus[]
}

export type VpnRevokeResponse = {
  ok: true
  clientId: string
  status: string
}

export type VpnAdminHealthResponse = {
  ok: true
  health: { ok: boolean; output: string }
}

export type VpnApiErrorResponse = {
  ok: false
  error: string
  message: string
  topupUrl?: string
}

// ── Package catalog + subscription (Stories 16/17) ──────────────────────

export type VpnPackageSummary = {
  id: string
  name: string
  description: string | null
  price: string
  currency: string
  serverCount: number
  protocolCount: number
  regions: string[]
}

export type VpnPackageServer = {
  serverId: string
  name: string
  region: { name: string; slug: string; countryCode: string }
  protocols: string[]
}

export type VpnPackageDetail = VpnPackageSummary & {
  servers: VpnPackageServer[]
}

export type VpnServerAccount = {
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

export type VpnSubscription = {
  id: string
  organizationId: string
  packageId: string
  status: "ACTIVE" | "SUSPENDED" | "EXPIRED"
  currentPeriodStart: string
  currentPeriodEnd: string
  priceLocked: string
  currency: string
  originalPrice: string | null
  originalCurrency: string | null
  exchangeRate: number | null
  serverAccounts: VpnServerAccount[]
  createdAt: string
  updatedAt: string
}

export type VpnProxyCredentials = {
  username: string
  password: string | null
}

async function fetchVpn<T>(
  endpoint: string,
  options?: RequestInit,
  timeoutMs = 15_000
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  const response = await fetch(endpoint, {
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  }).finally(() => clearTimeout(timer))

  const data = (await response.json()) as T | VpnApiErrorResponse

  if (!response.ok || (data as VpnApiErrorResponse).ok === false) {
    const errorData = data as VpnApiErrorResponse
    const error = new Error(
      errorData.message || `VPN API error: ${response.status}`
    )
    ;(error as Error & { error?: string; topupUrl?: string }).error =
      errorData.error
    ;(error as Error & { error?: string; topupUrl?: string }).topupUrl =
      errorData.topupUrl
    throw error
  }

  return data as T
}

export async function activateVpnSubscription(): Promise<VpnSubscriptionResponse> {
  return fetchVpn<VpnSubscriptionResponse>("/api/vpn/subscriptions", {
    method: "POST",
    body: JSON.stringify({ regionCode: "INDONESIA", planCode: "STANDARD" }),
  })
}

export async function getVpnStatus(): Promise<VpnStatusResponse> {
  return fetchVpn<VpnStatusResponse>("/api/vpn/status")
}

export async function revokeVpnClient(
  clientId: string
): Promise<VpnRevokeResponse> {
  return fetchVpn<VpnRevokeResponse>(`/api/vpn/clients/${clientId}/revoke`, {
    method: "POST",
  })
}

export async function getVpnAdminHealth(): Promise<VpnAdminHealthResponse> {
  return fetchVpn<VpnAdminHealthResponse>("/api/vpn/admin/health")
}

// ── Package catalog + subscription helpers (Stories 16/17) ──────────────

export async function listVpnPackages(): Promise<VpnPackageSummary[]> {
  const res = await fetchVpn<{ ok: true; data: VpnPackageSummary[] }>(
    "/api/vpn/packages"
  )
  return res.data
}

export async function getVpnPackage(id: string): Promise<VpnPackageDetail> {
  const res = await fetchVpn<{ ok: true; data: VpnPackageDetail }>(
    `/api/vpn/packages/${id}`
  )
  return res.data
}

export async function purchaseVpnPackage(id: string): Promise<VpnSubscription> {
  const res = await fetchVpn<{ ok: true; data: VpnSubscription }>(
    `/api/vpn/packages/${id}/purchase`,
    { method: "POST", body: JSON.stringify({}) }
  )
  return res.data
}

export async function listVpnSubscriptions(): Promise<VpnSubscription[]> {
  const res = await fetchVpn<{ ok: true; data: VpnSubscription[] }>(
    "/api/vpn/subscriptions"
  )
  return res.data
}

export async function cancelVpnSubscription(
  id: string
): Promise<VpnSubscription> {
  const res = await fetchVpn<{ ok: true; data: VpnSubscription }>(
    `/api/vpn/subscriptions/${id}/cancel`,
    { method: "POST", body: JSON.stringify({}) }
  )
  return res.data
}

export async function getVpnProxyCredentials(
  subscriptionId: string,
  serverAccountId: string
): Promise<VpnProxyCredentials> {
  const res = await fetchVpn<{ ok: true; data: VpnProxyCredentials }>(
    `/api/vpn/subscriptions/${subscriptionId}/servers/${serverAccountId}/credentials`
  )
  return res.data
}

export function vpnConfigDownloadUrl(
  subscriptionId: string,
  serverAccountId: string
): string {
  return `/api/vpn/subscriptions/${subscriptionId}/servers/${serverAccountId}/config`
}
