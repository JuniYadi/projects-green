import { beforeEach, describe, expect, it, mock } from "bun:test"

const stack = {
  id: "stack-1",
  organizationId: "org-1",
  slug: "demo",
  clusterId: "cluster-eu",
  subdomain: null,
  customDomain: null,
}
const endpoint = {
  id: "endpoint-1",
  clusterId: "cluster-eu",
  managedBaseDomain: "apps.example.com",
  cnameTarget: "edge.example.net",
  ipv4Addresses: ["203.0.113.10"],
  ipv6Addresses: ["2001:db8::10"],
  isActive: true,
}
const domains: Record<string, unknown>[] = []
const mockPrisma = {
  applicationStack: {
    findUnique: mock(async () => stack),
    update: mock(async ({ data }: { data: Record<string, unknown> }) => ({
      ...stack,
      ...data,
    })),
  },
  appHostingCluster: {
    findUnique: mock(async () => ({ id: "cluster-eu", status: "ACTIVE" })),
    findMany: mock(async () => []),
  },
  appHostingClusterEndpoint: {
    findUnique: mock(async () => endpoint),
    upsert: mock(async () => endpoint),
  },
  applicationDomain: {
    findFirst: mock(async ({ where }: { where: Record<string, unknown> }) => {
      if (where.hostname)
        return domains.find((row) => row.hostname === where.hostname) ?? null
      return (
        domains.find(
          (row) => row.id === where.id && row.stackId === where.stackId
        ) ?? null
      )
    }),
    findMany: mock(async () => domains),
    create: mock(async ({ data }: { data: Record<string, unknown> }) => {
      const row = {
        id: `domain-${domains.length + 1}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        verifiedAt: null,
      }
      domains.push(row)
      return row
    }),
    update: mock(async ({ data }: { data: Record<string, unknown> }) => {
      const updated = { ...domains[0], ...data }
      if (domains[0]) Object.assign(domains[0], updated)
      return updated
    }),
    updateMany: mock(async () => ({ count: 0 })),
    delete: mock(async () => domains.shift()),
  },
  applicationDomainCertificate: {
    create: mock(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "cert-1",
      ...data,
      expiresAt: null,
      fingerprint: null,
      validationError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    upsert: mock(async ({ create }: { create: Record<string, unknown> }) => ({
      id: "cert-1",
      ...create,
      expiresAt: null,
      fingerprint: null,
      validationError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  },
  applicationDomainAllowlistEntry: {
    create: mock(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "entry-1",
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    findFirst: mock(async () => null),
    delete: mock(async () => null),
  },
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

const {
  addAllowlistEntry,
  createDomainForStack,
  listDomainsForStack,
  normalizeCidr,
  normalizeHostname,
  updateAllowlist,
} = await import("./app-hosting-edge.service")

describe("app hosting edge service", () => {
  beforeEach(() => {
    domains.length = 0
    mockPrisma.applicationDomain.create.mockClear()
    mockPrisma.applicationDomainAllowlistEntry.create.mockClear()
  })

  it("creates a managed hostname and binds the resolved cluster", async () => {
    const result = await createDomainForStack({
      organizationId: "org-1",
      slug: "demo",
      kind: "MANAGED",
    })
    expect(result.hostname).toBe("demo.apps.example.com")
    expect(result.clusterId).toBe("cluster-eu")
    expect(mockPrisma.applicationDomain.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clusterId: "cluster-eu",
          kind: "MANAGED",
        }),
      })
    )
  })

  it("creates a custom domain without losing endpoint instructions", async () => {
    const result = await createDomainForStack({
      organizationId: "org-1",
      slug: "demo",
      kind: "CUSTOM",
      hostname: "WWW.Example.com",
    })
    expect(result.hostname).toBe("www.example.com")
    expect(result.endpoint.ipv4Addresses).toEqual(["203.0.113.10"])
    expect(result.endpoint.ipv6Addresses).toEqual(["2001:db8::10"])
  })

  it("returns deterministic domain order and keeps certificate data secret-free", async () => {
    domains.push({
      id: "domain-1",
      stackId: "stack-1",
      clusterId: "cluster-eu",
      hostname: "z.example.com",
      kind: "CUSTOM",
      isPrimary: false,
      dnsStatus: "PENDING",
      expectedCnameTarget: "edge.example.net",
      verifiedAt: null,
      allowlistMode: "OPEN",
      createdAt: new Date(),
      updatedAt: new Date(),
      certificate: {
        id: "cert-1",
        domainId: "domain-1",
        source: "UPLOADED",
        status: "ACTIVE",
        expiresAt: null,
        fingerprint: "sha",
        validationError: null,
        certificateCiphertext: "secret",
        privateKeyCiphertext: "private",
        chainCiphertext: null,
        keyVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      allowlistEntries: [],
    })
    const result = await listDomainsForStack({
      organizationId: "org-1",
      slug: "demo",
    })
    expect(result[0]?.certificate).not.toHaveProperty("certificateCiphertext")
    expect(result[0]?.certificate).not.toHaveProperty("privateKeyCiphertext")
  })

  it("normalizes CIDRs and supports domain-scoped allowlist mode", async () => {
    expect(normalizeHostname("App.Example.com.")).toBe("app.example.com")
    expect(normalizeCidr("203.0.113.0/24")).toBe("203.0.113.0/24")
    const created = await createDomainForStack({
      organizationId: "org-1",
      slug: "demo",
      kind: "CUSTOM",
      hostname: "secure.example.com",
    })
    const allowlist = await updateAllowlist({
      organizationId: "org-1",
      slug: "demo",
      domainId: created.id,
      mode: "ALLOWLIST_ONLY",
    })
    expect(allowlist.mode).toBe("ALLOWLIST_ONLY")
    await expect(
      addAllowlistEntry({
        organizationId: "org-1",
        slug: "demo",
        domainId: created.id,
        cidr: "203.0.113.0/24",
      })
    ).resolves.toBeDefined()
  })
})
