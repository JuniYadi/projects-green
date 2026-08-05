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
  uploadDomainCertificate,
  verifyDomain,
} = await import("./app-hosting-edge.service")

describe("app hosting edge service", () => {
  beforeEach(() => {
    domains.length = 0
    mockPrisma.applicationDomain.create.mockClear()
    mockPrisma.applicationDomainCertificate.create.mockClear()
    mockPrisma.applicationDomainCertificate.upsert.mockClear()
    resolveCname.mockReset()
    resolveCname.mockResolvedValue(["EDGE.EXAMPLE.NET."])
    resolve4.mockReset()
    resolve4.mockResolvedValue(["203.0.113.10"])
    resolve6.mockReset()
    resolve6.mockResolvedValue(["2001:db8::10"])
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
