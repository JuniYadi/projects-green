/**
 * VPN Mobile API client for console/portal frontend.
 *
 * Provides typed helpers for device listing, revocation, and QR pairing.
 * Follows the same pattern as lib/vpn-client.ts.
 */

// ── Types ────────────────────────────────────────────────────────────────

export type MobileDeviceEntry = {
  id: string
  deviceName: string
  platform: string
  osVersion: string | null
  subscriptionId: string
  subscriptionName: string | null
  subscriptionStatus: string | null
  status: "ACTIVE" | "SUSPENDED" | "REVOKED"
  pairedVia: "SSO" | "QR"
  lastSeenAt: string | null
  pairedAt: string
  revokedAt: string | null
  revokedReason: string | null
}

export type MobileDeviceListResponse = {
  devices: MobileDeviceEntry[]
}

export type PairingGenerateResponse = {
  pairingToken: string
  expiresAt: string
  qrPayload: string
}

export type PairingStatusResponse = {
  status: "valid" | "claimed" | "expired"
  claimedAt?: string
}

// ── API helpers ──────────────────────────────────────────────────────────

type ApiError = { ok?: false; error?: { code: string; message: string } }

async function fetchMobile<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "content-type": "application/json",
      ...options?.headers,
    },
    ...options,
  })

  const data = (await response.json()) as T | ApiError

  if (!response.ok) {
    const errorData = data as ApiError
    const message =
      errorData.error?.message ?? `Mobile API error: ${response.status}`
    throw new Error(message)
  }

  return data as T
}

/**
 * List devices for the current user's organization.
 */
export async function listMobileDevices(): Promise<MobileDeviceEntry[]> {
  const res = await fetchMobile<MobileDeviceListResponse>(
    "/api/vpn/mobile/devices"
  )
  return res.devices
}

/**
 * Revoke a specific device.
 */
export async function revokeMobileDevice(deviceId: string): Promise<void> {
  await fetchMobile(`/api/vpn/mobile/devices/${deviceId}`, {
    method: "DELETE",
  })
}

/**
 * Rename a device.
 */
export async function renameMobileDevice(
  deviceId: string,
  deviceName: string
): Promise<void> {
  await fetchMobile(`/api/vpn/mobile/devices/${deviceId}`, {
    method: "PATCH",
    body: JSON.stringify({ deviceName }),
  })
}

/**
 * Generate a QR pairing token for a subscription.
 */
export async function generatePairingToken(
  subscriptionId: string
): Promise<PairingGenerateResponse> {
  return fetchMobile<PairingGenerateResponse>(
    "/api/vpn/mobile/pairing/generate",
    {
      method: "POST",
      body: JSON.stringify({ subscriptionId }),
    }
  )
}

/**
 * Check the status of a pairing token (for QR modal polling).
 */
export async function getPairingStatus(
  token: string
): Promise<PairingStatusResponse> {
  return fetchMobile<PairingStatusResponse>(
    `/api/vpn/mobile/pairing/status/${encodeURIComponent(token)}`
  )
}
