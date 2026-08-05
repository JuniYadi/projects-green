import { beforeEach, describe, expect, it, mock } from "bun:test"
import * as realCrypto from "node:crypto"

const resolveCname = mock(async () => ["EDGE.EXAMPLE.NET."])
const resolve4 = mock(async () => ["203.0.113.10"])
const resolve6 = mock(async () => ["2001:db8::10"])
mock.module("node:dns", () => ({
  promises: { resolveCname, resolve4, resolve6 },
}))

class FakeX509Certificate {
  validTo = "2099-01-01T00:00:00.000Z"
  fingerprint256 = "fingerprint"
  subjectAltName: string | undefined
  subject: string

  constructor(pem: string) {
    if (pem.includes("CN_ONLY_VALID")) {
      this.subject = "CN=secure.example.com"
    } else if (pem.includes("CN_ONLY_INVALID")) {
      this.subject = "CN=other.example.com"
    } else {
      this.subject = "CN=other.example.com"
      this.subjectAltName = "DNS:secure.example.com"
    }
  }
}
mock.module("node:crypto", () => ({
  ...realCrypto,
  X509Certificate: FakeX509Certificate,
  createPrivateKey: () => ({}),
  default: {
    ...realCrypto,
    X509Certificate: FakeX509Certificate,
    createPrivateKey: () => ({}),
  },
}))
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
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
}
const domains: Record<string, unknown>[] = []
const mockPrisma = {
  applicationStack: {
    findUnique: mock(async (): Promise<typeof stack | null> => stack),
    update: mock(async ({ data }: { data: Record<string, unknown> }) => ({
      ...stack,
      ...data,
    })),
  },
  appHostingCluster: {
    findUnique: mock(
      async (): Promise<{ id: string; status: string } | null> => ({
        id: "cluster-eu",
        status: "ACTIVE",
      })
    ),
    findMany: mock(async (): Promise<Array<{ id: string }>> => []),
  },
  appHostingClusterEndpoint: {
    findUnique: mock(async (): Promise<typeof endpoint | null> => endpoint),
    upsert: mock(async (_args: unknown) => endpoint),
  },
  applicationDomain: {
    findFirst: mock(async ({ where }: { where: Record<string, unknown> }) => {
      if (where.hostname)
        return domains.find((row) => row.hostname === where.hostname) ?? null
      if (where.id)
        return (
          domains.find(
            (row) => row.id === where.id && row.stackId === where.stackId
          ) ?? null
        )
      return domains.find((row) => row.stackId === where.stackId) ?? null
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
    delete: mock(async ({ where }: { where: Record<string, unknown> }) => {
      const index = domains.findIndex((row) => row.id === where.id)
      return index >= 0 ? domains.splice(index, 1)[0] : null
    }),
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
    findFirst: mock(
      async (): Promise<{ id: string; domainId: string } | null> => null
    ),
    delete: mock(async () => null),
  },
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

const {
  addAllowlistEntry,
  createDomainForStack,
  deleteAllowlistEntry,
  deleteDomainForStack,
  ensureManagedDomainForStack,
  getAllowlist,
  getClusterEndpoint,
  listDomainsForStack,
  normalizeCidr,
  normalizeHostname,
  updateAllowlist,
  uploadDomainCertificate,
  upsertClusterEndpoint,
  verifyDomain,
} = await import("./app-hosting-edge.service")
const {
  toApplicationDomainAllowlistEntryDTO,
  toApplicationDomainCertificateDTO,
  toApplicationDomainDTO,
} = await import("./app-hosting-edge.dto")

describe("app hosting edge service", () => {
  beforeEach(() => {
    Object.assign(stack, {
      clusterId: "cluster-eu",
      subdomain: null,
      customDomain: null,
    })
    domains.length = 0
    mockPrisma.applicationStack.findUnique.mockReset()
    mockPrisma.applicationStack.findUnique.mockResolvedValue(stack)
    mockPrisma.applicationStack.update.mockClear()
    mockPrisma.appHostingCluster.findUnique.mockReset()
    mockPrisma.appHostingCluster.findUnique.mockResolvedValue({
      id: "cluster-eu",
      status: "ACTIVE",
    })
    mockPrisma.appHostingCluster.findMany.mockReset()
    mockPrisma.appHostingCluster.findMany.mockResolvedValue([])
    mockPrisma.appHostingClusterEndpoint.findUnique.mockReset()
    mockPrisma.appHostingClusterEndpoint.findUnique.mockResolvedValue(endpoint)
    mockPrisma.appHostingClusterEndpoint.upsert.mockClear()
    mockPrisma.applicationDomain.create.mockClear()
    mockPrisma.applicationDomain.update.mockClear()
    mockPrisma.applicationDomain.updateMany.mockClear()
    mockPrisma.applicationDomain.delete.mockClear()
    mockPrisma.applicationDomainCertificate.create.mockClear()
    mockPrisma.applicationDomainCertificate.upsert.mockClear()
    mockPrisma.applicationDomainAllowlistEntry.create.mockClear()
    mockPrisma.applicationDomainAllowlistEntry.findFirst.mockReset()
    mockPrisma.applicationDomainAllowlistEntry.findFirst.mockResolvedValue(null)
    mockPrisma.applicationDomainAllowlistEntry.delete.mockClear()
    resolveCname.mockReset()
    resolveCname.mockResolvedValue(["EDGE.EXAMPLE.NET."])
    resolve4.mockReset()
    resolve4.mockResolvedValue(["203.0.113.10"])
    resolve6.mockReset()
    resolve6.mockResolvedValue(["2001:db8::10"])
  })
  const seedDomain = (overrides: Record<string, unknown> = {}) => {
    const row = {
      id: `domain-${domains.length + 1}`,
      stackId: "stack-1",
      clusterId: "cluster-eu",
      hostname: "secure.example.com",
      kind: "CUSTOM",
      isPrimary: false,
      dnsStatus: "PENDING",
      expectedCnameTarget: "edge.example.net",
      verifiedAt: null,
      allowlistMode: "OPEN",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      certificate: null,
      allowlistEntries: [],
      ...overrides,
    }
    domains.push(row)
    return row
  }

  it("resolves and upserts cluster endpoints with normalized addresses", async () => {
    await expect(getClusterEndpoint("cluster-eu")).resolves.toMatchObject({
      id: "endpoint-1",
      clusterId: "cluster-eu",
    })
    await upsertClusterEndpoint("cluster-eu", {
      managedBaseDomain: "Apps.Example.com.",
      cnameTarget: "EDGE.Example.net.",
      ipv4Addresses: [" 203.0.113.10", "203.0.113.10"],
      ipv6Addresses: ["2001:DB8::10", "2001:db8::10"],
      isActive: false,
    })
    expect(
      mockPrisma.appHostingClusterEndpoint.upsert.mock.calls[0]?.[0]
    ).toMatchObject({
      create: {
        managedBaseDomain: "apps.example.com",
        cnameTarget: "edge.example.net",
        ipv4Addresses: ["203.0.113.10", "203.0.113.10"],
        ipv6Addresses: ["2001:db8::10", "2001:db8::10"],
        isActive: false,
      },
    })
  })

  it("rejects missing clusters, endpoints, and invalid endpoint addresses", async () => {
    mockPrisma.appHostingCluster.findUnique.mockResolvedValueOnce(null)
    await expect(getClusterEndpoint("missing")).rejects.toThrow(
      "App Hosting cluster not found"
    )
    mockPrisma.appHostingCluster.findUnique.mockResolvedValueOnce({
      id: "cluster-eu",
      status: "ACTIVE",
    })
    mockPrisma.appHostingClusterEndpoint.findUnique.mockResolvedValueOnce(null)
    await expect(getClusterEndpoint("cluster-eu")).rejects.toThrow(
      "cluster edge endpoint not found"
    )
    await expect(
      upsertClusterEndpoint("cluster-eu", {
        managedBaseDomain: "apps.example.com",
        cnameTarget: "edge.example.net",
        ipv4Addresses: ["2001:db8::1"],
      })
    ).rejects.toThrow("ipv4Addresses must contain only IPv4 addresses")
    await expect(
      upsertClusterEndpoint("cluster-eu", {
        managedBaseDomain: "apps.example.com",
        cnameTarget: "edge.example.net",
        ipv6Addresses: ["203.0.113.1"],
      })
    ).rejects.toThrow("ipv6Addresses must contain only IPv6 addresses")
  })

  it("handles default-cluster selection and inactive endpoint failures", async () => {
    Object.assign(stack, { clusterId: null })
    await expect(
      createDomainForStack({
        organizationId: "org-1",
        slug: "demo",
        kind: "MANAGED",
      })
    ).rejects.toThrow("no active default App Hosting cluster configured")
    mockPrisma.appHostingCluster.findMany.mockResolvedValueOnce([
      { id: "cluster-a" },
      { id: "cluster-b" },
    ])
    await expect(
      createDomainForStack({
        organizationId: "org-1",
        slug: "demo",
        kind: "MANAGED",
      })
    ).rejects.toThrow("multiple active default App Hosting clusters configured")
    mockPrisma.appHostingCluster.findMany.mockResolvedValueOnce([
      { id: "cluster-a" },
    ])
    const created = await createDomainForStack({
      organizationId: "org-1",
      slug: "demo",
      kind: "MANAGED",
    })
    expect(created.clusterId).toBe("cluster-eu")
    Object.assign(stack, { clusterId: "cluster-eu" })
    mockPrisma.appHostingCluster.findUnique.mockResolvedValueOnce({
      id: "cluster-eu",
      status: "INACTIVE",
    })
    await expect(
      createDomainForStack({
        organizationId: "org-1",
        slug: "demo",
        kind: "MANAGED",
      })
    ).rejects.toThrow("no active App Hosting cluster configured")
    mockPrisma.appHostingClusterEndpoint.findUnique.mockResolvedValueOnce({
      ...endpoint,
      isActive: false,
    })
    await expect(
      createDomainForStack({
        organizationId: "org-1",
        slug: "demo",
        kind: "MANAGED",
      })
    ).rejects.toThrow("no active edge endpoint configured")
  })

  it("rejects invalid and duplicate domain creation requests", async () => {
    await expect(
      createDomainForStack({
        organizationId: "org-1",
        slug: "demo",
        kind: "INVALID" as never,
      })
    ).rejects.toThrow("kind must be MANAGED or CUSTOM")
    await expect(
      createDomainForStack({
        organizationId: "org-1",
        slug: "demo",
        kind: "CUSTOM",
      })
    ).rejects.toThrow("hostname must be a valid fully-qualified domain name")
    seedDomain({ hostname: "secure.example.com" })
    await expect(
      createDomainForStack({
        organizationId: "org-1",
        slug: "demo",
        kind: "CUSTOM",
        hostname: "secure.example.com",
      })
    ).rejects.toThrow("a domain with this hostname already exists")
  })

  it("marks DNS verification failed when all DNS strategies fail", async () => {
    resolveCname.mockRejectedValueOnce(new Error("no cname"))
    resolve4.mockRejectedValueOnce(new Error("no ipv4"))
    resolve6.mockRejectedValueOnce(new Error("no ipv6"))
    seedDomain()
    const result = await verifyDomain({
      organizationId: "org-1",
      slug: "demo",
      domainId: "domain-1",
    })
    expect(result.dnsStatus).toBe("FAILED")
    expect(result.verifiedAt).toBeNull()
  })

  it("deletes a primary custom domain and promotes the next domain", async () => {
    Object.assign(stack, { customDomain: "secure.example.com" })
    seedDomain({ isPrimary: true })
    seedDomain({
      kind: "MANAGED",
      hostname: "demo.apps.example.com",
      isPrimary: false,
    })
    const deleted = await deleteDomainForStack({
      organizationId: "org-1",
      slug: "demo",
      domainId: "domain-1",
    })
    expect(deleted.hostname).toBe("secure.example.com")
    expect(mockPrisma.applicationStack.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { customDomain: null } })
    )
    expect(mockPrisma.applicationDomain.update).toHaveBeenCalledWith({
      where: { id: "domain-2" },
      data: { isPrimary: true },
    })
    expect(mockPrisma.applicationStack.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { subdomain: "demo.apps.example.com" } })
    )
  })

  it("rejects deletion of an unknown domain", async () => {
    await expect(
      deleteDomainForStack({
        organizationId: "org-1",
        slug: "demo",
        domainId: "missing",
      })
    ).rejects.toThrow("application domain not found")
  })

  it("validates uploaded certificate material before persistence", async () => {
    seedDomain({ dnsStatus: "VERIFIED", verifiedAt: new Date() })
    await expect(
      uploadDomainCertificate({
        organizationId: "org-1",
        slug: "demo",
        domainId: "domain-1",
        certificate: "not-pem",
        privateKey: "-----BEGIN PRIVATE KEY-----key",
      })
    ).rejects.toThrow("certificate must be PEM encoded")
    await expect(
      uploadDomainCertificate({
        organizationId: "org-1",
        slug: "demo",
        domainId: "domain-1",
        certificate: "-----BEGIN CERTIFICATE-----cert",
        privateKey: "not-pem",
      })
    ).rejects.toThrow("privateKey must be PEM encoded")
  })

  it("maps allowlist entries and translates duplicate persistence errors", async () => {
    seedDomain({
      allowlistMode: "ALLOWLIST_ONLY",
      allowlistEntries: [
        {
          id: "entry-2",
          domainId: "domain-1",
          cidr: "10.0.0.0/8",
          description: null,
          enabled: true,
          position: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    })
    await expect(
      getAllowlist({
        organizationId: "org-1",
        slug: "demo",
        domainId: "domain-1",
      })
    ).resolves.toMatchObject({
      mode: "ALLOWLIST_ONLY",
      entries: [{ id: "entry-2" }],
    })
    mockPrisma.applicationDomainAllowlistEntry.create.mockRejectedValueOnce(
      new Error("P2002 unique constraint")
    )
    await expect(
      addAllowlistEntry({
        organizationId: "org-1",
        slug: "demo",
        domainId: "domain-1",
        cidr: "10.0.0.0/8",
      })
    ).rejects.toThrow("this CIDR already exists for the domain")
  })

  it("deletes allowlist entries and reports missing entries", async () => {
    seedDomain({
      allowlistEntries: [
        {
          id: "entry-1",
          domainId: "domain-1",
          cidr: "10.0.0.0/8",
          description: null,
          enabled: true,
          position: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    })
    await expect(
      deleteAllowlistEntry({
        organizationId: "org-1",
        slug: "demo",
        domainId: "domain-1",
        entryId: "missing",
      })
    ).rejects.toThrow("allowlist entry not found")
    mockPrisma.applicationDomainAllowlistEntry.findFirst.mockResolvedValueOnce({
      id: "entry-1",
      domainId: "domain-1",
    })
    await expect(
      deleteAllowlistEntry({
        organizationId: "org-1",
        slug: "demo",
        domainId: "domain-1",
        entryId: "entry-1",
      })
    ).resolves.toMatchObject({ domainId: "domain-1" })
    expect(
      mockPrisma.applicationDomainAllowlistEntry.delete
    ).toHaveBeenCalledWith({ where: { id: "entry-1" } })
  })

  it("ensures an existing managed domain has a certificate and binding", async () => {
    seedDomain({
      kind: "MANAGED",
      hostname: "demo.apps.example.com",
      certificate: null,
    })
    const result = await ensureManagedDomainForStack("stack-1")
    expect(result.hostname).toBe("demo.apps.example.com")
    expect(mockPrisma.applicationDomainCertificate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          domainId: "domain-1",
          source: "MANAGED",
        }),
      })
    )
    expect(mockPrisma.applicationStack.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { subdomain: "demo.apps.example.com" } })
    )
  })

  it("reports a missing stack while ensuring a managed domain", async () => {
    mockPrisma.applicationStack.findUnique.mockResolvedValueOnce(null)
    await expect(ensureManagedDomainForStack("missing")).rejects.toThrow(
      "application stack not found"
    )
  })

  it("maps populated DTO relations without exposing certificate secrets", () => {
    const now = new Date("2026-02-01T00:00:00.000Z")
    const entry = toApplicationDomainAllowlistEntryDTO({
      id: "entry-1",
      domainId: "domain-1",
      cidr: "10.0.0.0/8",
      description: "internal",
      enabled: true,
      position: 1,
      createdAt: now,
      updatedAt: now,
    })
    const dto = toApplicationDomainDTO(
      {
        id: "domain-1",
        stackId: "stack-1",
        clusterId: "cluster-eu",
        hostname: "secure.example.com",
        kind: "CUSTOM",
        isPrimary: true,
        dnsStatus: "VERIFIED",
        expectedCnameTarget: "edge.example.net",
        verifiedAt: now,
        allowlistMode: "ALLOWLIST_ONLY",
        createdAt: now,
        updatedAt: now,
        cluster: {
          id: "cluster-eu",
          code: "EU",
          name: "Europe",
          region: "eu-west",
        },
        certificate: {
          id: "cert-1",
          domainId: "domain-1",
          source: "UPLOADED",
          status: "ACTIVE",
          tlsSecretName: "tls-secret",
          expiresAt: now,
          fingerprint: "sha256",
          validationError: null,
          createdAt: now,
          updatedAt: now,
          certificateCiphertext: "certificate-secret",
          privateKeyCiphertext: "key-secret",
          chainCiphertext: null,
          keyVersion: 1,
        },
        allowlistEntries: [entry],
      } as never,
      endpoint
    )
    expect(dto.cluster).toEqual({
      id: "cluster-eu",
      code: "EU",
      name: "Europe",
      region: "eu-west",
    })
    expect(dto.allowlistEntries).toEqual([entry])
    expect(dto.certificate).toMatchObject({ secretName: "tls-secret" })
    expect(dto.certificate).not.toHaveProperty("certificateCiphertext")
    expect(toApplicationDomainCertificateDTO(null)).toBeNull()
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
        tlsSecretName: "app-domain-domain-1-tls",
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
    expect(result[0]?.certificate?.secretName).toBe("app-domain-domain-1-tls")
  })

  it("normalizes DNS CNAME answers against the stored target", async () => {
    domains.push({
      id: "domain-1",
      stackId: "stack-1",
      clusterId: "cluster-eu",
      hostname: "secure.example.com",
      kind: "CUSTOM",
      isPrimary: true,
      dnsStatus: "PENDING",
      expectedCnameTarget: "edge.example.net",
      verifiedAt: null,
      allowlistMode: "OPEN",
      createdAt: new Date(),
      updatedAt: new Date(),
      certificate: null,
      allowlistEntries: [],
    })
    const result = await verifyDomain({
      organizationId: "org-1",
      slug: "demo",
      domainId: "domain-1",
    })
    expect(result.dnsStatus).toBe("VERIFIED")
  })

  it("verifies uppercase IPv6 DNS answers case-insensitively", async () => {
    resolveCname.mockRejectedValueOnce(new Error("no cname"))
    resolve4.mockResolvedValueOnce([])
    resolve6.mockResolvedValueOnce(["2001:DB8::10"])
    domains.push({
      id: "domain-1",
      stackId: "stack-1",
      clusterId: "cluster-eu",
      hostname: "secure.example.com",
      kind: "CUSTOM",
      isPrimary: true,
      dnsStatus: "PENDING",
      expectedCnameTarget: "edge.example.net",
      verifiedAt: null,
      allowlistMode: "OPEN",
      createdAt: new Date(),
      updatedAt: new Date(),
      certificate: null,
      allowlistEntries: [],
    })
    const result = await verifyDomain({
      organizationId: "org-1",
      slug: "demo",
      domainId: "domain-1",
    })
    expect(result.dnsStatus).toBe("VERIFIED")
  })

  it("accepts a certificate whose subject CN covers the hostname", async () => {
    domains.push({
      id: "domain-1",
      stackId: "stack-1",
      clusterId: "cluster-eu",
      hostname: "secure.example.com",
      kind: "CUSTOM",
      isPrimary: true,
      dnsStatus: "VERIFIED",
      expectedCnameTarget: "edge.example.net",
      verifiedAt: new Date(),
      allowlistMode: "OPEN",
      createdAt: new Date(),
      updatedAt: new Date(),
      certificate: null,
      allowlistEntries: [],
    })
    const result = await uploadDomainCertificate({
      organizationId: "org-1",
      slug: "demo",
      domainId: "domain-1",
      certificate:
        "-----BEGIN CERTIFICATE-----CN_ONLY_VALID-----END CERTIFICATE-----",
      privateKey: "-----BEGIN PRIVATE KEY-----key-----END PRIVATE KEY-----",
    })
    expect(result.certificate?.secretName).toBe("app-domain-domain-1-tls")
    expect(mockPrisma.applicationDomainCertificate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          tlsSecretName: "app-domain-domain-1-tls",
        }),
        update: expect.objectContaining({
          tlsSecretName: "app-domain-domain-1-tls",
        }),
      })
    )
  })

  it("rejects a certificate whose SAN and subject CN miss the hostname", async () => {
    domains.push({
      id: "domain-1",
      stackId: "stack-1",
      clusterId: "cluster-eu",
      hostname: "secure.example.com",
      kind: "CUSTOM",
      isPrimary: true,
      dnsStatus: "VERIFIED",
      expectedCnameTarget: "edge.example.net",
      verifiedAt: new Date(),
      allowlistMode: "OPEN",
      createdAt: new Date(),
      updatedAt: new Date(),
      certificate: null,
      allowlistEntries: [],
    })
    await expect(
      uploadDomainCertificate({
        organizationId: "org-1",
        slug: "demo",
        domainId: "domain-1",
        certificate:
          "-----BEGIN CERTIFICATE-----CN_ONLY_INVALID-----END CERTIFICATE-----",
        privateKey: "-----BEGIN PRIVATE KEY-----key-----END PRIVATE KEY-----",
      })
    ).rejects.toThrow("certificate does not cover the requested hostname")
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
