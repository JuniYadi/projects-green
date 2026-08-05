import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockWithAuth = mock(async () => ({
  user: { id: "user-1", email: "user@example.com" },
  organizationId: "org-1",
  role: "admin",
  roles: ["admin"],
}))

const domain = {
  id: "domain-1",
  stackId: "stack-1",
  clusterId: "cluster-1",
  hostname: "app.example.test",
  kind: "CUSTOM",
  isPrimary: true,
  dnsStatus: "PENDING",
  expectedCnameTarget: "edge.example.test",
  verifiedAt: null,
  certificate: null,
  endpoint: { managedBaseDomain: "apps.example.test" },
  allowlistMode: "OPEN",
  allowlistEntries: [],
}

const mockService = {
  listDomainsForStack: mock(async () => [domain]),
  createDomainForStack: mock(async () => domain),
  deleteDomainForStack: mock(async () => domain),
  verifyDomain: mock(async () => ({ ...domain, dnsStatus: "VERIFIED" })),
  uploadDomainCertificate: mock(async () => ({
    ...domain,
    certificate: {
      source: "UPLOADED",
      status: "ACTIVE",
      expiresAt: "2030-01-01T00:00:00.000Z",
      fingerprint: "fingerprint",
    },
  })),
  getAllowlist: mock(async () => ({
    domainId: "domain-1",
    mode: "OPEN",
    entries: [],
  })),
  updateAllowlist: mock(async () => ({
    domainId: "domain-1",
    mode: "ALLOWLIST_ONLY",
    entries: [],
  })),
  addAllowlistEntry: mock(async () => ({
    domainId: "domain-1",
    mode: "ALLOWLIST_ONLY",
    entries: [
      {
        id: "entry-1",
        cidr: "10.0.0.0/8",
        description: "internal",
        enabled: true,
        position: 0,
      },
    ],
  })),
  deleteAllowlistEntry: mock(async () => ({
    domainId: "domain-1",
    mode: "ALLOWLIST_ONLY",
    entries: [],
  })),
}

mock.module("@workos-inc/authkit-nextjs", () => ({ withAuth: mockWithAuth }))
mock.module("@/lib/platform-role", () => ({
  getPlatformRoleForUser: mock(async () => "member"),
}))
mock.module("@/modules/tenants/tenant-policy", () => ({
  hasScopedSuperAdminClaim: () => false,
  resolveTenantRoleFromClaims: () => "admin",
}))
mock.module("@/modules/deploy/app-hosting-edge.service", () => mockService)

const { appHostingEdgeRoutes } = await import("./app-hosting-edge.route")

const request = (
  path: string,
  method = "GET",
  body?: Record<string, unknown>
) =>
  appHostingEdgeRoutes.handle(
    new Request(`http://localhost${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    })
  )

describe("app hosting edge tenant routes", () => {
  beforeEach(() => {
    mockWithAuth.mockReset()
    mockWithAuth.mockResolvedValue({
      user: { id: "user-1", email: "user@example.com" },
      organizationId: "org-1",
      role: "admin",
      roles: ["admin"],
    })
    mockService.listDomainsForStack.mockClear()
    mockService.createDomainForStack.mockClear()
    mockService.deleteDomainForStack.mockClear()
    mockService.verifyDomain.mockClear()
    mockService.uploadDomainCertificate.mockClear()
    mockService.getAllowlist.mockClear()
    mockService.updateAllowlist.mockClear()
    mockService.addAllowlistEntry.mockClear()
    mockService.deleteAllowlistEntry.mockClear()
  })

  it("rejects unauthenticated domain reads", async () => {
    mockWithAuth.mockResolvedValueOnce({ user: null } as never)
    const response = await request("/deploy/apps/app/domains")
    expect(response.status).toBe(401)
  })

  it("lists, creates, verifies, and deletes through the organization service contract", async () => {
    const list = await request("/deploy/apps/app/domains")
    expect(list.status).toBe(200)
    expect((await list.json()).data[0].kind).toBe("CUSTOM")

    const created = await request("/deploy/apps/app/domains", "POST", {
      kind: "MANAGED",
      isPrimary: true,
    })
    expect(created.status).toBe(200)
    expect(mockService.createDomainForStack).toHaveBeenCalledWith({
      organizationId: "org-1",
      slug: "app",
      hostname: undefined,
      kind: "MANAGED",
      isPrimary: true,
    })

    const verified = await request(
      "/deploy/apps/app/domains/domain-1/verify",
      "POST"
    )
    expect(verified.status).toBe(200)
    expect((await verified.json()).data.dnsStatus).toBe("VERIFIED")

    const deleted = await request("/deploy/apps/app/domains/domain-1", "DELETE")
    expect(deleted.status).toBe(200)
  })

  it("uploads certificates without returning secret material", async () => {
    const response = await request(
      "/deploy/apps/app/domains/domain-1/certificate",
      "PUT",
      {
        certificate: "CERTIFICATE DATA",
        privateKey: "PRIVATE KEY DATA",
        chain: "CHAIN DATA",
      }
    )
    const payload = await response.json()
    expect(response.status).toBe(200)
    expect(payload.data.certificate.fingerprint).toBe("fingerprint")
    expect(JSON.stringify(payload)).not.toContain("PRIVATE KEY DATA")
    expect(JSON.stringify(payload)).not.toContain("CERTIFICATE DATA")
  })

  it("mutates allowlist mode and entries", async () => {
    const mode = await request(
      "/deploy/apps/app/domains/domain-1/allowlist",
      "PUT",
      { mode: "ALLOWLIST_ONLY" }
    )
    expect(mode.status).toBe(200)
    expect((await mode.json()).data.mode).toBe("ALLOWLIST_ONLY")

    const entry = await request(
      "/deploy/apps/app/domains/domain-1/allowlist/entries",
      "POST",
      { cidr: "10.0.0.0/8", description: "internal" }
    )
    expect(entry.status).toBe(200)
    expect((await entry.json()).data.entries[0].cidr).toBe("10.0.0.0/8")
  })
})
