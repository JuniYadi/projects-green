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

async function fetchVpn<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(endpoint, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  })

  const data = (await response.json()) as T | VpnApiErrorResponse

  if (!response.ok || (data as VpnApiErrorResponse).ok === false) {
    const errorData = data as VpnApiErrorResponse
    const error = new Error(errorData.message || `VPN API error: ${response.status}`)
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
  clientId: string,
): Promise<VpnRevokeResponse> {
  return fetchVpn<VpnRevokeResponse>(`/api/vpn/clients/${clientId}/revoke`, {
    method: "POST",
  })
}

export async function getVpnAdminHealth(): Promise<VpnAdminHealthResponse> {
  return fetchVpn<VpnAdminHealthResponse>("/api/vpn/admin/health")
}
