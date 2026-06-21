"use client"

import { eden } from "@/lib/eden"

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

// ── Helpers ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Eden response union requires narrowing
type EdenRes = { data: any; error: any }

function throwIfError(res: EdenRes) {
  if (res.error) throw new Error(String(res.error))
  const body = res.data as Record<string, unknown> | null
  if (!body || (body && "ok" in body && body.ok === false)) {
    const msg =
      body && "message" in body && typeof body.message === "string"
        ? body.message
        : "Request failed"
    throw new Error(msg)
  }
}

// ── Regions ──────────────────────────────────────────────────────────────

export async function listVpnRegions() {
  const res = (await eden.api.admin.vpn.regions.get()) as EdenRes
  throwIfError(res)
  return res as { data: VpnRegionItem[] }
}

export async function createVpnRegion(body: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Eden infers strict body types; generic callers pass untyped objects
  const res = (await eden.api.admin.vpn.regions.post(body as any)) as EdenRes
  throwIfError(res)
}

export async function updateVpnRegion(
  id: string,
  body: Record<string, unknown>
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Eden infers strict body types; generic callers pass untyped objects
  const res = (await eden.api.admin.vpn.regions[id].put(body as any)) as EdenRes
  throwIfError(res)
}

export async function deleteVpnRegion(id: string) {
  const res = (await eden.api.admin.vpn.regions[id].delete()) as EdenRes
  throwIfError(res)
}

// ── Servers ──────────────────────────────────────────────────────────────

export async function listVpnServers(query?: Record<string, string>) {
  const res = (
    query
      ? await eden.api.admin.vpn.servers.get({ $query: query })
      : await eden.api.admin.vpn.servers.get()
  ) as EdenRes
  throwIfError(res)
  return res as { data: VpnServerItem[] }
}

export async function createVpnServer(body: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Eden infers strict body types; generic callers pass untyped objects
  const res = (await eden.api.admin.vpn.servers.post(body as any)) as EdenRes
  throwIfError(res)
  return res as { data: { id: string } }
}

export async function updateVpnServer(
  id: string,
  body: Record<string, unknown>
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Eden infers strict body types; generic callers pass untyped objects
  const res = (await eden.api.admin.vpn.servers[id].put(body as any)) as EdenRes
  throwIfError(res)
}

export async function deleteVpnServer(id: string) {
  const res = (await eden.api.admin.vpn.servers[id].delete()) as EdenRes
  throwIfError(res)
}

export async function testVpnServer(id: string, init?: RequestInit) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Eden POST body type doesn't accept RequestInit
  const res = (await eden.api.admin.vpn.servers[id].test.post(init as any)) as EdenRes
  throwIfError(res)
  return res as { data: ScanResult }
}

// ── SSH Keys ─────────────────────────────────────────────────────────────

export async function listVpnSshKeys() {
  const res = (await eden.api.admin.vpn["ssh-keys"].get()) as EdenRes
  throwIfError(res)
  return res as { data: VpnSshKeyItem[] }
}

export async function createVpnSshKey(body: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Eden infers strict body types; generic callers pass untyped objects
  const res = (await eden.api.admin.vpn["ssh-keys"].post(body as any)) as EdenRes
  throwIfError(res)
}

export async function deleteVpnSshKey(id: string) {
  const res = (await eden.api.admin.vpn["ssh-keys"][id].delete()) as EdenRes
  throwIfError(res)
}

// ── Packages ─────────────────────────────────────────────────────────────

export async function listVpnPackages() {
  const res = (await eden.api.admin.vpn.packages.get()) as EdenRes
  throwIfError(res)
  return res as { data: VpnPackageItem[] }
}

export async function createVpnPackage(body: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Eden infers strict body types; generic callers pass untyped objects
  const res = (await eden.api.admin.vpn.packages.post(body as any)) as EdenRes
  throwIfError(res)
}

export async function updateVpnPackage(
  id: string,
  body: Record<string, unknown>
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Eden infers strict body types; generic callers pass untyped objects
  const res = (await eden.api.admin.vpn.packages[id].put(body as any)) as EdenRes
  throwIfError(res)
}

export async function deleteVpnPackage(id: string) {
  const res = (await eden.api.admin.vpn.packages[id].delete()) as EdenRes
  throwIfError(res)
}

// ── Subscriptions ────────────────────────────────────────────────────────

export async function listVpnAdminSubscriptions() {
  const res = (await eden.api.admin.vpn.subscriptions.get()) as EdenRes
  throwIfError(res)
  return res as { data: VpnSubscriptionItem[] }
}

export async function getVpnAdminSubscription(id: string) {
  const res = (await eden.api.admin.vpn.subscriptions[id].get()) as EdenRes
  throwIfError(res)
  return res as { data: VpnSubscriptionItem }
}

export async function retryVpnServerAccount(
  subId: string,
  saId: string
) {
  const res = (
    await eden.api.admin.vpn.subscriptions[subId].servers[saId].retry.post()
  ) as EdenRes
  throwIfError(res)
}

export async function revokeVpnServerAccount(
  subId: string,
  saId: string
) {
  const res = (
    await eden.api.admin.vpn.subscriptions[subId].servers[saId].revoke.post()
  ) as EdenRes
  throwIfError(res)
}

export async function retryAllVpnServerAccounts(subId: string) {
  const res = (
    await eden.api.admin.vpn.subscriptions[subId]["retry-all"].post()
  ) as EdenRes
  throwIfError(res)
}

// ── Audit ────────────────────────────────────────────────────────────────

type AuditEntry = {
  id: string
  serverAccountId: string | null
  action: string
  step: string | null
  status: string | null
  details: Record<string, unknown> | null
  createdAt: string
}

export async function getVpnProvisioningAudit(
  saId: string,
  query?: Record<string, string>
) {
  const res = (
    query
      ? await eden.api.admin.vpn.audit.accounts[saId].get({ $query: query })
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Eden route requires args; no-arg variant is valid
        await eden.api.admin.vpn.audit.accounts[saId].get({} as any)
  ) as EdenRes
  throwIfError(res)
  return res as { data: AuditEntry[] }
}

// ── Mobile Devices (admin) ───────────────────────────────────────────────

type AdminDeviceEntry = {
  id: string
  deviceName: string
  platform: string
  osVersion: string | null
  subscriptionId: string
  organizationId: string
  organizationName: string | null
  status: "ACTIVE" | "SUSPENDED" | "REVOKED"
  pairedVia: "SSO" | "QR"
  lastSeenAt: string | null
  pairedAt: string
  revokedAt: string | null
  revokedReason: string | null
}

export async function listVpnMobileAdminDevices(
  query: Record<string, string>
) {
  const res = (
    await eden.api.vpn.mobile.admin.devices.get({ $query: query })
  ) as EdenRes
  throwIfError(res)
  return res as {
    data: {
      devices: AdminDeviceEntry[]
      total: number
      page: number
      limit: number
    }
  }
}

export async function revokeVpnMobileDevice(
  id: string,
  body?: Record<string, unknown>
) {
  const res = (
    await eden.api.vpn.mobile.admin.devices[id].delete(body ?? {})
  ) as EdenRes
  throwIfError(res)
}
