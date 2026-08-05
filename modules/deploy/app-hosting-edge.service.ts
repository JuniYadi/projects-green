import { createHash, createPrivateKey, X509Certificate } from "node:crypto"
import { isIP } from "node:net"
import { promises as dns } from "node:dns"
import { prisma } from "@/lib/prisma"
import {
  encrypt,
  getEncryptionKey,
  serializeEncryptedField,
} from "@/lib/encryption"
import {
  toAppHostingClusterEndpointDTO,
  toApplicationDomainAllowlistEntryDTO,
  toApplicationDomainDTO,
} from "./app-hosting-edge.dto"
import type {
  AddAllowlistEntryInput,
  ApplicationDomainAllowlistDTO,
  CreateDomainForStackInput,
  DeleteAllowlistEntryInput,
  DomainForStackInput,
  ListDomainsForStackInput,
  UpdateAllowlistInput,
  UploadDomainCertificateInput,
} from "./app-hosting-edge.types"
import type { ApplicationDomainDTO } from "./app-hosting-edge.types"

class EdgeServiceError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = "EdgeServiceError"
    this.code = code
  }
}
export class EdgeValidationError extends EdgeServiceError {
  constructor(message: string) {
    super("VALIDATION", message)
  }
}
export class EdgeNotFoundError extends EdgeServiceError {
  constructor(message: string) {
    super("NOT_FOUND", message)
  }
}
export class EdgeConflictError extends EdgeServiceError {
  constructor(message: string) {
    super("CONFLICT", message)
  }
}

// Keep this deliberately structural so focused tests can replace Prisma with a small mock.
type EdgeDb = {
  applicationStack: {
    findUnique(args: unknown): Promise<unknown>
    update(args: unknown): Promise<unknown>
  }
  appHostingCluster: {
    findUnique(args: unknown): Promise<unknown>
    findMany(args: unknown): Promise<unknown>
  }

  appHostingClusterEndpoint: {
    findUnique(args: unknown): Promise<unknown>
    upsert(args: unknown): Promise<unknown>
  }
  applicationDomain: {
    findFirst(args: unknown): Promise<unknown>
    findMany(args: unknown): Promise<unknown>
    create(args: unknown): Promise<unknown>
    update(args: unknown): Promise<unknown>
    updateMany(args: unknown): Promise<unknown>
    delete(args: unknown): Promise<unknown>
  }
  applicationDomainCertificate: {
    create(args: unknown): Promise<unknown>
    upsert(args: unknown): Promise<unknown>
  }
  applicationDomainAllowlistEntry: {
    create(args: unknown): Promise<unknown>
    findFirst(args: unknown): Promise<unknown>
    delete(args: unknown): Promise<unknown>
  }
}
const db = prisma as unknown as EdgeDb

const HOSTNAME_RE =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/
function failIf(condition: boolean, message: string): void {
  if (condition) throw new EdgeValidationError(message)
}

export function normalizeHostname(value: string): string {
  const hostname = value.trim().replace(/\.$/, "").toLowerCase()
  failIf(
    !HOSTNAME_RE.test(hostname),
    "hostname must be a valid fully-qualified domain name"
  )
  return hostname
}

export function normalizeCidr(value: string): string {
  const input = value.trim().toLowerCase()
  const slash = input.lastIndexOf("/")
  failIf(
    slash <= 0 || slash === input.length - 1,
    "cidr must include an address and prefix length"
  )
  const address = input.slice(0, slash)
  const prefix = Number(input.slice(slash + 1))
  const family = isIP(address)
  failIf(
    family === 0 || !Number.isInteger(prefix),
    "cidr must be a valid IPv4 or IPv6 network"
  )
  failIf(
    prefix < 0 || (family === 4 ? prefix > 32 : prefix > 128),
    "cidr prefix length is out of range"
  )
  return `${address}/${prefix}`
}

function encrypted(value: string): string {
  return serializeEncryptedField(encrypt(value, getEncryptionKey()))
}

export type UpsertClusterEndpointInput = {
  managedBaseDomain: string
  cnameTarget: string
  ipv4Addresses?: string[]
  ipv6Addresses?: string[]
  isActive?: boolean
}

export async function getClusterEndpoint(clusterId: string) {
  const cluster = await db.appHostingCluster.findUnique({
    where: { id: clusterId },
  })
  if (!cluster) throw new EdgeNotFoundError("App Hosting cluster not found")
  const endpoint = await db.appHostingClusterEndpoint.findUnique({
    where: { clusterId },
  })
  if (!endpoint) throw new EdgeNotFoundError("cluster edge endpoint not found")
  return toAppHostingClusterEndpointDTO(endpoint as never)
}

export async function upsertClusterEndpoint(
  clusterId: string,
  input: UpsertClusterEndpointInput
) {
  const cluster = await db.appHostingCluster.findUnique({
    where: { id: clusterId },
  })
  if (!cluster) throw new EdgeNotFoundError("App Hosting cluster not found")
  const ipv4Addresses = [...new Set(input.ipv4Addresses ?? [])].map((value) =>
    value.trim()
  )
  const ipv6Addresses = [...new Set(input.ipv6Addresses ?? [])].map((value) =>
    value.trim().toLowerCase()
  )
  failIf(
    ipv4Addresses.some((value) => isIP(value) !== 4),
    "ipv4Addresses must contain only IPv4 addresses"
  )
  failIf(
    ipv6Addresses.some((value) => isIP(value) !== 6),
    "ipv6Addresses must contain only IPv6 addresses"
  )
  const endpoint = await db.appHostingClusterEndpoint.upsert({
    where: { clusterId },
    create: {
      clusterId,
      managedBaseDomain: normalizeHostname(input.managedBaseDomain),
      cnameTarget: normalizeHostname(input.cnameTarget),
      ipv4Addresses,
      ipv6Addresses,
      isActive: input.isActive ?? true,
    },
    update: {
      managedBaseDomain: normalizeHostname(input.managedBaseDomain),
      cnameTarget: normalizeHostname(input.cnameTarget),
      ipv4Addresses,
      ipv6Addresses,
      isActive: input.isActive ?? true,
    },
  })
  return toAppHostingClusterEndpointDTO(endpoint as never)
}

async function findStack(input: { organizationId: string; slug: string }) {
  const stack = (await db.applicationStack.findUnique({
    where: {
      organizationId_slug: {
        organizationId: input.organizationId,
        slug: input.slug,
      },
    },
  })) as {
    id: string
    slug: string
    clusterId: string | null
    subdomain?: string | null
    customDomain?: string | null
  } | null
  if (!stack) throw new EdgeNotFoundError("application stack not found")
  return stack
}

async function resolveEndpoint(stack: { clusterId: string | null }) {
  let clusterId = stack.clusterId
  if (clusterId) {
    const cluster = (await db.appHostingCluster.findUnique({
      where: { id: clusterId },
    })) as { id: string; status: string } | null
    if (!cluster || cluster.status !== "ACTIVE")
      throw new EdgeNotFoundError("no active App Hosting cluster configured")
  } else {
    const defaults = (await db.appHostingCluster.findMany({
      where: { status: "ACTIVE", isDefault: true },
      orderBy: [{ createdAt: "asc" }],
    })) as Array<{ id: string }>
    if (defaults.length === 0)
      throw new EdgeNotFoundError(
        "no active default App Hosting cluster configured"
      )
    if (defaults.length > 1)
      throw new EdgeConflictError(
        "multiple active default App Hosting clusters configured"
      )
    clusterId = defaults[0].id
  }
  const endpoint = (await db.appHostingClusterEndpoint.findUnique({
    where: { clusterId },
  })) as {
    id: string
    clusterId: string
    managedBaseDomain: string
    cnameTarget: string
    ipv4Addresses: string[]
    ipv6Addresses: string[]
    isActive: boolean
  } | null
  if (!endpoint || !endpoint.isActive)
    throw new EdgeNotFoundError(
      "no active edge endpoint configured for App Hosting cluster"
    )
  return endpoint
}

async function findDomain(input: DomainForStackInput) {
  const stack = await findStack(input)
  const domain = (await db.applicationDomain.findFirst({
    where: { id: input.domainId, stackId: stack.id },
    include: { certificate: true, allowlistEntries: true, cluster: true },
  })) as Record<string, unknown> | null
  if (!domain) throw new EdgeNotFoundError("application domain not found")
  const endpoint = await resolveEndpoint({
    clusterId: String(domain.clusterId),
  })
  return { stack, domain, endpoint }
}

function mapDomain(
  domain: Record<string, unknown>,
  endpoint: Record<string, unknown>
): ApplicationDomainDTO {
  return toApplicationDomainDTO(domain as never, endpoint as never)
}

export async function listDomainsForStack(
  input: ListDomainsForStackInput
): Promise<ApplicationDomainDTO[]> {
  const stack = await findStack(input)
  const rows = (await db.applicationDomain.findMany({
    where: { stackId: stack.id },
    include: { certificate: true, allowlistEntries: true, cluster: true },
    orderBy: [{ hostname: "asc" }, { createdAt: "asc" }],
  })) as Array<Record<string, unknown>>
  const result: ApplicationDomainDTO[] = []
  for (const row of rows)
    result.push(
      mapDomain(
        row,
        await resolveEndpoint({ clusterId: String(row.clusterId) })
      )
    )
  return result
}

export async function createDomainForStack(
  input: CreateDomainForStackInput
): Promise<ApplicationDomainDTO> {
  failIf(
    input.kind !== "MANAGED" && input.kind !== "CUSTOM",
    "kind must be MANAGED or CUSTOM"
  )
  const stack = await findStack(input)
  const endpoint = await resolveEndpoint(stack)
  const base = normalizeHostname(endpoint.managedBaseDomain)
  const hostname =
    input.kind === "MANAGED"
      ? normalizeHostname(`${stack.slug}.${base}`)
      : normalizeHostname(input.hostname ?? "")
  const existing = await db.applicationDomain.findFirst({ where: { hostname } })
  if (existing)
    throw new EdgeConflictError("a domain with this hostname already exists")
  const isPrimary = input.isPrimary ?? true
  if (isPrimary)
    await db.applicationDomain.updateMany({
      where: { stackId: stack.id },
      data: { isPrimary: false },
    })
  const row = (await db.applicationDomain.create({
    data: {
      stackId: stack.id,
      clusterId: endpoint.clusterId,
      hostname,
      kind: input.kind,
      isPrimary,
      dnsStatus: "PENDING",
      expectedCnameTarget: normalizeHostname(endpoint.cnameTarget),
      allowlistMode: "OPEN",
    },
    include: { certificate: true, allowlistEntries: true, cluster: true },
  })) as Record<string, unknown>
  const certificate = await db.applicationDomainCertificate.create({
    data: { domainId: String(row.id), source: "MANAGED", status: "PENDING" },
  })
  row.certificate = certificate
  row.allowlistEntries = []
  if (isPrimary) {
    await db.applicationStack.update({
      where: { id: stack.id },
      data:
        input.kind === "CUSTOM"
          ? { customDomain: hostname }
          : { subdomain: hostname },
    })
  }
  return mapDomain(row, endpoint)
}

export async function verifyDomain(
  input: DomainForStackInput
): Promise<ApplicationDomainDTO> {
  const { domain, endpoint } = await findDomain(input)
  const hostname = String(domain.hostname)
  let verified = false
  try {
    const cname = await dns.resolveCname(hostname)
    verified = cname.some(
      (value) =>
        normalizeHostname(value) ===
        normalizeHostname(String(domain.expectedCnameTarget))
    )
  } catch {
    try {
      const addresses = [
        ...(await dns.resolve4(hostname)),
        ...(await dns.resolve6(hostname)),
      ]
      const expected = new Set([
        ...endpoint.ipv4Addresses,
        ...endpoint.ipv6Addresses,
      ])
      verified = addresses.some((value) => expected.has(value))
    } catch {
      verified = false
    }
  }
  const updated = (await db.applicationDomain.update({
    where: { id: input.domainId },
    data: {
      dnsStatus: verified ? "VERIFIED" : "FAILED",
      verifiedAt: verified ? new Date() : null,
    },
    include: { certificate: true, allowlistEntries: true },
  })) as Record<string, unknown>
  return mapDomain(updated, endpoint)
}

export async function deleteDomainForStack(
  input: DomainForStackInput
): Promise<ApplicationDomainDTO> {
  const { stack, domain, endpoint } = await findDomain(input)
  const deletedDomain = mapDomain(domain, endpoint)
  const wasPrimary = Boolean(domain.isPrimary)
  await db.applicationDomain.delete({ where: { id: input.domainId } })
  if (domain.kind === "CUSTOM" && stack.customDomain === domain.hostname)
    await db.applicationStack.update({
      where: { id: stack.id },
      data: { customDomain: null },
    })
  if (domain.kind === "MANAGED" && stack.subdomain === domain.hostname)
    await db.applicationStack.update({
      where: { id: stack.id },
      data: { subdomain: null },
    })
  if (wasPrimary) {
    const next = (await db.applicationDomain.findFirst({
      where: { stackId: stack.id },
      orderBy: [{ createdAt: "asc" }, { hostname: "asc" }],
    })) as { id: string; kind: string; hostname: string } | null
    if (next) {
      await db.applicationDomain.update({
        where: { id: next.id },
        data: { isPrimary: true },
      })
      await db.applicationStack.update({
        where: { id: stack.id },
        data:
          next.kind === "CUSTOM"
            ? { customDomain: next.hostname }
            : { subdomain: next.hostname },
      })
    }
  }
  return deletedDomain
}

function parseUploadedCertificate(
  input: UploadDomainCertificateInput,
  hostname: string
) {
  failIf(
    !input.certificate.includes("-----BEGIN CERTIFICATE-----"),
    "certificate must be PEM encoded"
  )
  failIf(
    !input.privateKey.includes("-----BEGIN"),
    "privateKey must be PEM encoded"
  )
  let certificate: X509Certificate
  try {
    certificate = new X509Certificate(input.certificate)
    createPrivateKey(input.privateKey)
  } catch {
    throw new EdgeValidationError(
      "certificate and privateKey must be valid PEM material"
    )
  }
  const expiresAt = new Date(certificate.validTo)
  failIf(
    !Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now(),
    "certificate is expired"
  )
  const san =
    certificate.subjectAltName
      ?.split(",")
      .map((item) => item.trim().replace(/^DNS:/, "").toLowerCase()) ?? []
  const covered = san.some(
    (name) =>
      name === hostname ||
      (name.startsWith("*.") && hostname.endsWith(name.slice(1)))
  )
  failIf(
    san.length > 0 && !covered,
    "certificate does not cover the requested hostname"
  )
  if (input.chain) {
    const chainCertificates =
      input.chain.match(
        /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g
      ) ?? []
    for (const part of chainCertificates) {
      try {
        new X509Certificate(part)
      } catch {
        throw new EdgeValidationError(
          "chain must contain valid PEM certificates"
        )
      }
    }
  }
  return {
    expiresAt,
    fingerprint:
      certificate.fingerprint256 ||
      createHash("sha256").update(input.certificate).digest("hex"),
  }
}

export async function uploadDomainCertificate(
  input: UploadDomainCertificateInput
): Promise<ApplicationDomainDTO> {
  const { domain, endpoint } = await findDomain(input)
  const parsed = parseUploadedCertificate(input, String(domain.hostname))
  const row = await db.applicationDomainCertificate.upsert({
    where: { domainId: input.domainId },
    create: {
      domainId: input.domainId,
      source: "UPLOADED",
      status: "ACTIVE",
      expiresAt: parsed.expiresAt,
      fingerprint: parsed.fingerprint,
      validationError: null,
      certificateCiphertext: encrypted(input.certificate),
      privateKeyCiphertext: encrypted(input.privateKey),
      chainCiphertext: input.chain ? encrypted(input.chain) : null,
      keyVersion: 1,
    },
    update: {
      source: "UPLOADED",
      status: "ACTIVE",
      expiresAt: parsed.expiresAt,
      fingerprint: parsed.fingerprint,
      validationError: null,
      certificateCiphertext: encrypted(input.certificate),
      privateKeyCiphertext: encrypted(input.privateKey),
      chainCiphertext: input.chain ? encrypted(input.chain) : null,
    },
  })
  domain.certificate = row
  return mapDomain(domain, endpoint)
}

export async function getAllowlist(
  input: DomainForStackInput
): Promise<ApplicationDomainAllowlistDTO> {
  const { domain } = await findDomain(input)
  const entries = (
    (domain.allowlistEntries as Array<Record<string, unknown>> | undefined) ??
    []
  )
    .map((entry) => toApplicationDomainAllowlistEntryDTO(entry as never))
    .sort((a, b) => a.position - b.position || a.cidr.localeCompare(b.cidr))
  return {
    domainId: input.domainId,
    mode: domain.allowlistMode as ApplicationDomainAllowlistDTO["mode"],
    entries,
  }
}

export async function updateAllowlist(
  input: UpdateAllowlistInput
): Promise<ApplicationDomainAllowlistDTO> {
  failIf(
    input.mode !== "OPEN" && input.mode !== "ALLOWLIST_ONLY",
    "mode must be OPEN or ALLOWLIST_ONLY"
  )
  await findDomain(input)
  await db.applicationDomain.update({
    where: { id: input.domainId },
    data: { allowlistMode: input.mode },
  })
  return getAllowlist(input)
}

export async function addAllowlistEntry(
  input: AddAllowlistEntryInput
): Promise<ApplicationDomainAllowlistDTO> {
  const cidr = normalizeCidr(input.cidr)
  await findDomain(input)
  const position = input.position ?? 0
  failIf(
    !Number.isInteger(position) || position < 0,
    "position must be a non-negative integer"
  )
  try {
    await db.applicationDomainAllowlistEntry.create({
      data: {
        domainId: input.domainId,
        cidr,
        description: input.description?.trim() || null,
        enabled: input.enabled ?? true,
        position,
      },
    })
  } catch (error) {
    if (
      String(error).includes("Unique constraint") ||
      String(error).includes("P2002")
    )
      throw new EdgeConflictError("this CIDR already exists for the domain")
    throw error
  }
  return getAllowlist(input)
}

export async function deleteAllowlistEntry(
  input: DeleteAllowlistEntryInput
): Promise<ApplicationDomainAllowlistDTO> {
  await findDomain(input)
  const entry = await db.applicationDomainAllowlistEntry.findFirst({
    where: { id: input.entryId, domainId: input.domainId },
  })
  if (!entry) throw new EdgeNotFoundError("allowlist entry not found")
  await db.applicationDomainAllowlistEntry.delete({
    where: { id: input.entryId },
  })
  return getAllowlist(input)
}

/** Ensure deploy creation has one persisted managed domain without changing an existing binding. */
export async function ensureManagedDomainForStack(
  stackId: string
): Promise<ApplicationDomainDTO> {
  const stack = (await db.applicationStack.findUnique({
    where: { id: stackId },
  })) as {
    id: string
    organizationId: string
    slug: string
    clusterId: string | null
    subdomain?: string | null
  } | null
  if (!stack) throw new EdgeNotFoundError("application stack not found")
  const existing = (await db.applicationDomain.findFirst({
    where: { stackId: stack.id, kind: "MANAGED" },
    include: { certificate: true, allowlistEntries: true, cluster: true },
    orderBy: { createdAt: "asc" },
  })) as Record<string, unknown> | null
  if (existing) {
    const endpoint = await resolveEndpoint({
      clusterId: String(existing.clusterId),
    })
    if (!existing.certificate) {
      existing.certificate = await db.applicationDomainCertificate.create({
        data: {
          domainId: String(existing.id),
          source: "MANAGED",
          status: "PENDING",
        },
      })
    }
    if (stack.subdomain !== existing.hostname) {
      await db.applicationStack.update({
        where: { id: stack.id },
        data: { subdomain: existing.hostname },
      })
    }
    return mapDomain(existing, endpoint)
  }
  return createDomainForStack({
    organizationId: stack.organizationId,
    slug: stack.slug,
    kind: "MANAGED",
    isPrimary: true,
  })
}
