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

export type VpnServerTrafficPoint = {
  label: string
  rx: number
  tx: number
  total: number
}

export type VpnServerProcessItem = {
  pid: number
  command: string
  cpu: number
  memory: number
}

export type VpnServerMetrics = {
  ports: {
    openVpn: number | null
    wireGuard: number | null
    proxy: number | null
  }
  uptime: string | null
  resources: {
    cpu: {
      usedPercent: number | null
      totalCores: number | null
    }
    memory: {
      used: number | null
      total: number | null
    }
    currentMonthBandwidth: number
  }
  traffic: {
    daily: VpnServerTrafficPoint[]
    monthly: VpnServerTrafficPoint[]
  }
  processes: {
    cpu: VpnServerProcessItem[]
    memory: VpnServerProcessItem[]
  }
  collectedAt: string
}

export type OpenVpnUserItem = {
  clientName: string
  status: "ACTIVE" | "REVOKED" | "UNKNOWN"
  serial: string | null
  expiresAt: string | null
  ipAllocation: string | null
  connected: boolean
  realAddress: string | null
  virtualAddress: string | null
  bytesReceived: number | null
  bytesSent: number | null
  connectedSince: string | null
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
  hostname: string
  ipAddress: string | null
  region: { name: string; slug: string; countryCode: string } | null
  port: number | null
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

type ApiBody<T> = { ok: true; data: T } | { ok: false; message?: string }

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

function unwrapData<T>(res: EdenRes): { data: T } {
  throwIfError(res)

  const body = res.data as ApiBody<T> | T
  if (
    body &&
    typeof body === "object" &&
    "ok" in body &&
    body.ok === true &&
    "data" in body
  ) {
    return { data: (body as { data: T }).data }
  }

  return { data: body as T }
}

// ── Regions ──────────────────────────────────────────────────────────────

export async function listVpnRegions() {
  const res = (await eden.api.admin.vpn.regions.get()) as EdenRes
  return unwrapData<VpnRegionItem[]>(res)
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
  return unwrapData<VpnServerItem[]>(res)
}

export async function getVpnServer(id: string) {
  const res = (await eden.api.admin.vpn.servers[id].get()) as EdenRes
  return unwrapData<VpnServerItem>(res)
}

export async function listOpenVpnUsers(serverId: string) {
  const res = (
    await eden.api.admin.vpn.servers[serverId]["openvpn-users"].get()
  ) as EdenRes
  return unwrapData<OpenVpnUserItem[]>(res)
}

export async function getVpnServerMetrics(serverId: string) {
  const res = (
    await eden.api.admin.vpn.servers[serverId].metrics.get()
  ) as EdenRes
  return unwrapData<VpnServerMetrics>(res)
}

export async function createVpnServer(body: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Eden infers strict body types; generic callers pass untyped objects
  const res = (await eden.api.admin.vpn.servers.post(body as any)) as EdenRes
  return unwrapData<{ id: string }>(res)
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
  return unwrapData<ScanResult>(res)
}

// ── Sync Protocols ─────────────────────────────────────────────────────────

type SyncProtocolsResult = { ok: true; queued: boolean; correlationId: string }

export async function syncVpnServerProtocols(id: string) {
  const res = (await eden.api.admin.vpn.servers[id][
    "sync-protocols"
  ].post()) as EdenRes
  return unwrapData<SyncProtocolsResult>(res)
}

// ── SSH Keys ─────────────────────────────────────────────────────────────

export async function listVpnSshKeys() {
  const res = (await eden.api.admin.vpn["ssh-keys"].get()) as EdenRes
  return unwrapData<VpnSshKeyItem[]>(res)
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
  return unwrapData<VpnPackageItem[]>(res)
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

export type VpnAdminSubscriptionsQuery = {
  orgId?: string
  packageId?: string
  status?: "ACTIVE" | "SUSPENDED" | "EXPIRED"
  periodStartFrom?: string
  periodStartTo?: string
  q?: string
  page?: number
  limit?: number
}

export type PaginationMeta = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export async function listVpnAdminSubscriptions(query: VpnAdminSubscriptionsQuery = {}) {
  const $query: Record<string, string> = {}
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      $query[key] = String(value)
    }
  }

  const res = (await eden.api.admin.vpn.subscriptions.get({ $query })) as EdenRes
  throwIfError(res)

  const body = res.data as
    | { ok: true; data: VpnSubscriptionItem[]; pagination: PaginationMeta }
    | VpnSubscriptionItem[]

  if (Array.isArray(body)) {
    return {
      data: body,
      pagination: { page: 1, limit: body.length, total: body.length, totalPages: 1 },
    }
  }

  return { data: body.data, pagination: body.pagination }
}

export async function getVpnAdminSubscription(id: string) {
  const res = (await eden.api.admin.vpn.subscriptions[id].get()) as EdenRes
  return unwrapData<VpnSubscriptionItem>(res)
}

export type VpnAccountValidationResult = {
  exists: boolean
  status: "FOUND" | "MISSING"
  message: string
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

export async function validateVpnServerAccount(
  subId: string,
  saId: string
) {
  const res = (
    await eden.api.admin.vpn.subscriptions[subId].servers[saId].validate.post()
  ) as EdenRes
  return unwrapData<VpnAccountValidationResult>(res)
}

export async function recreateVpnServerAccount(
  subId: string,
  saId: string
) {
  const res = (
    await eden.api.admin.vpn.subscriptions[subId].servers[saId].recreate.post()
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

export function vpnAdminConfigDownloadUrl(subId: string, saId: string): string {
  return `/api/admin/vpn/subscriptions/${subId}/servers/${saId}/config`
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
  return unwrapData<AuditEntry[]>(res)
}

// ── Audit Log (global list) ─────────────────────────────────────────────

export type VpnAuditLogListItem = {
  id: string
  serverAccountId: string | null
  deviceId: string | null
  userId: string | null
  adminId: string | null
  action: string
  step: string | null
  status: string | null
  // `Prisma.JsonValue` → serialized as `unknown` on the wire.
  details: Record<string, unknown> | null
  ip: string | null
  userAgent: string | null
  createdAt: string
}

export type AuditLogPagination = {
  page: number
  limit: number
  total: number
  totalPages: number
}

type AuditListResponse = {
  data: VpnAuditLogListItem[]
  pagination: AuditLogPagination
}

export type AuditLogQuery = {
  page?: number
  limit?: number
  action?: string
  status?: string
  q?: string
  from?: string
  to?: string
}

export async function listVpnAuditLogs(query: AuditLogQuery = {}) {
  const $query: Record<string, string> = {}
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      $query[key] = String(value)
    }
  }

  const res = (await eden.api.admin.vpn.audit.get({ $query })) as EdenRes
  throwIfError(res)

  const body = res.data as
    | { ok: true; data: VpnAuditLogListItem[]; pagination: AuditLogPagination }
    | VpnAuditLogListItem[]

  // The route returns an envelope with pagination; fall back to a bare array
  // for forward-compat with simpler list endpoints.
  if (Array.isArray(body)) {
    return {
      data: body,
      pagination: { page: 1, limit: body.length, total: body.length, totalPages: 1 },
    }
  }

  return { data: body.data, pagination: body.pagination }
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
  return unwrapData<{
    devices: AdminDeviceEntry[]
    total: number
    page: number
    limit: number
  }>(res)
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
