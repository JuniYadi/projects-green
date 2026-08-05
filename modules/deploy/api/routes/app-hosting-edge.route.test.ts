import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockWithAuth = mock(async () => ({
  user: { id: "user-1", email: "user@example.com" },
  organizationId: "org-1",
  role: "admin",
  roles: ["admin"],
}))

const mockGetPlatformRole = mock(async () => "member")
const mockHasScopedSuperAdminClaim = mock(() => false)
const mockResolveTenantRole = mock(() => "admin")

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
  getPlatformRoleForUser: mockGetPlatformRole,
}))
mock.module("@/modules/tenants/tenant-policy", () => ({
  hasScopedSuperAdminClaim: mockHasScopedSuperAdminClaim,
  resolveTenantRoleFromClaims: mockResolveTenantRole,
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
    mockGetPlatformRole.mockReset()
    mockGetPlatformRole.mockResolvedValue("member")
    mockHasScopedSuperAdminClaim.mockReset()
    mockHasScopedSuperAdminClaim.mockReturnValue(false)
    mockResolveTenantRole.mockReset()
    mockResolveTenantRole.mockReturnValue("admin")
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

  it("returns explicit authentication errors", async () => {
    mockWithAuth.mockResolvedValueOnce({ user: null } as never)
    const unauthenticated = await request("/deploy/apps/app/domains")
    expect(unauthenticated.status).toBe(401)
    expect((await unauthenticated.json()).error).toBe("UNAUTHORIZED")

    mockWithAuth.mockResolvedValueOnce({ user: { id: "user-1" } } as never)
    const withoutOrganization = await request("/deploy/apps/app/domains")
    expect(withoutOrganization.status).toBe(403)
    expect((await withoutOrganization.json()).error).toBe("FORBIDDEN")
  })

  it("allows tenant owners and rejects tenant members for manager routes", async () => {
    mockResolveTenantRole.mockReturnValueOnce("owner")
    const custom = await request("/deploy/apps/app/domains", "POST", {
      hostname: "custom.example.test",
      kind: "CUSTOM",
      isPrimary: false,
    })
    expect(custom.status).toBe(200)
    expect(mockService.createDomainForStack).toHaveBeenCalledWith({
      organizationId: "org-1",
      slug: "app",
      hostname: "custom.example.test",
      kind: "CUSTOM",
      isPrimary: false,
    })

    mockResolveTenantRole.mockReturnValueOnce("member")
    const forbidden = await request("/deploy/apps/app/domains", "POST", {
      kind: "MANAGED",
    })
    expect(forbidden.status).toBe(403)
    expect((await forbidden.json()).error).toBe("FORBIDDEN")
  })

  it("accepts platform and scoped super admins for manager routes", async () => {
    mockResolveTenantRole.mockReturnValue("member")
    mockGetPlatformRole.mockResolvedValueOnce("super_admin")
    const platformAdmin = await request(
      "/deploy/apps/app/domains/domain-1",
      "DELETE"
    )
    expect(platformAdmin.status).toBe(200)

    mockHasScopedSuperAdminClaim.mockReturnValueOnce(true)
    const scopedAdmin = await request(
      "/deploy/apps/app/domains/domain-1",
      "DELETE"
    )
    expect(scopedAdmin.status).toBe(200)
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
    expect((await deleted.json()).data.id).toBe("domain-1")
  })

  it("maps service failures to route error responses", async () => {
    mockService.listDomainsForStack.mockRejectedValueOnce(
      Object.assign(new Error("domain missing"), { code: "NOT_FOUND" })
    )
    const listFailure = await request("/deploy/apps/app/domains")
    expect(listFailure.status).toBe(404)
    expect((await listFailure.json()).error).toBe("NOT_FOUND")

    mockService.createDomainForStack.mockRejectedValueOnce(
      new Error("duplicate hostname")
    )
    const createFailure = await request("/deploy/apps/app/domains", "POST", {
      kind: "MANAGED",
    })
    expect(createFailure.status).toBe(409)
    expect((await createFailure.json()).error).toBe("CONFLICT")

    mockService.deleteDomainForStack.mockRejectedValueOnce(
      new Error("organization access forbidden")
    )
    const deleteFailure = await request(
      "/deploy/apps/app/domains/domain-1",
      "DELETE"
    )
    expect(deleteFailure.status).toBe(403)
    expect((await deleteFailure.json()).error).toBe("FORBIDDEN")

    mockService.verifyDomain.mockRejectedValueOnce(
      new Error("DNS check failed")
    )
    const verifyFailure = await request(
      "/deploy/apps/app/domains/domain-1/verify",
      "POST"
    )
    expect(verifyFailure.status).toBe(422)
    expect((await verifyFailure.json()).error).toBe("INVALID_DOMAIN_REQUEST")

    mockService.uploadDomainCertificate.mockRejectedValueOnce(
      new Error("certificate and privateKey must be valid PEM material")
    )
    const certificateFailure = await request(
      "/deploy/apps/app/domains/domain-1/certificate",
      "PUT",
      { certificate: "bad", privateKey: "bad" }
    )
    expect(certificateFailure.status).toBe(422)
    expect((await certificateFailure.json()).error).toBe(
      "INVALID_DOMAIN_REQUEST"
    )

    mockService.getAllowlist.mockRejectedValueOnce(new Error("NOT_FOUND"))
    const getAllowlistFailure = await request(
      "/deploy/apps/app/domains/domain-1/allowlist"
    )
    expect(getAllowlistFailure.status).toBe(404)

    mockService.updateAllowlist.mockRejectedValueOnce(
      new Error("primary domain conflict")
    )
    const updateAllowlistFailure = await request(
      "/deploy/apps/app/domains/domain-1/allowlist",
      "PUT",
      { mode: "OPEN" }
    )
    expect(updateAllowlistFailure.status).toBe(409)

    mockService.addAllowlistEntry.mockRejectedValueOnce(new Error("bad cidr"))
    const addAllowlistFailure = await request(
      "/deploy/apps/app/domains/domain-1/allowlist/entries",
      "POST",
      { cidr: "invalid" }
    )
    expect(addAllowlistFailure.status).toBe(422)

    mockService.deleteAllowlistEntry.mockRejectedValueOnce(
      new Error("NOT_FOUND")
    )
    const deleteAllowlistFailure = await request(
      "/deploy/apps/app/domains/domain-1/allowlist/entries/entry-1",
      "DELETE"
    )
    expect(deleteAllowlistFailure.status).toBe(404)
    mockService.listDomainsForStack.mockRejectedValueOnce(
      Object.assign(new Error("session expired"), { code: "UNAUTHORIZED" })
    )
    const serviceUnauthorized = await request("/deploy/apps/app/domains")
    expect(serviceUnauthorized.status).toBe(401)
    expect((await serviceUnauthorized.json()).error).toBe("UNAUTHORIZED")

    mockService.listDomainsForStack.mockRejectedValueOnce("unexpected failure")
    const unknownFailure = await request("/deploy/apps/app/domains")
    expect(unknownFailure.status).toBe(422)
    expect((await unknownFailure.json()).message).toBe(
      "Domain operation failed"
    )
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

  it("reads and mutates allowlist mode and entries", async () => {
    const current = await request("/deploy/apps/app/domains/domain-1/allowlist")
    expect(current.status).toBe(200)
    expect((await current.json()).data.mode).toBe("OPEN")
    expect(mockService.getAllowlist).toHaveBeenCalledWith({
      organizationId: "org-1",
      slug: "app",
      domainId: "domain-1",
    })

    const mode = await request(
      "/deploy/apps/app/domains/domain-1/allowlist",
      "PUT",
      { mode: "ALLOWLIST_ONLY" }
    )
    expect(mode.status).toBe(200)
    expect((await mode.json()).data.mode).toBe("ALLOWLIST_ONLY")
    expect(mockService.updateAllowlist).toHaveBeenCalledWith({
      organizationId: "org-1",
      slug: "app",
      domainId: "domain-1",
      mode: "ALLOWLIST_ONLY",
    })

    const entry = await request(
      "/deploy/apps/app/domains/domain-1/allowlist/entries",
      "POST",
      {
        cidr: "10.0.0.0/8",
        description: "internal",
        enabled: false,
        position: 3,
      }
    )
    expect(entry.status).toBe(200)
    expect((await entry.json()).data.entries[0].cidr).toBe("10.0.0.0/8")
    expect(mockService.addAllowlistEntry).toHaveBeenCalledWith({
      organizationId: "org-1",
      slug: "app",
      domainId: "domain-1",
      cidr: "10.0.0.0/8",
      description: "internal",
      enabled: false,
      position: 3,
    })

    const deleted = await request(
      "/deploy/apps/app/domains/domain-1/allowlist/entries/entry-1",
      "DELETE"
    )
    expect(deleted.status).toBe(200)
    expect((await deleted.json()).data.entries).toEqual([])
    expect(mockService.deleteAllowlistEntry).toHaveBeenCalledWith({
      organizationId: "org-1",
      slug: "app",
      domainId: "domain-1",
      entryId: "entry-1",
    })
  })
})
