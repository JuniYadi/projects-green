import { describe, expect, it, mock } from "bun:test"

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: async () => ({
    user: null,
    organizationId: null,
    role: null,
    roles: [],
  }),
}))

mock.module("@/lib/platform-role", () => ({
  getPlatformRoleForUser: async () => "none",
}))

const { ensureTenantContextAccess } =
  await import("@/modules/tenants/api/tenants.guards")

describe("tenants.guards", () => {
  it("returns policy error when tenant role is missing for matching organization context", () => {
    const set = {}

    const result = ensureTenantContextAccess(
      "org_1",
      {
        userId: "user_1",
        organizationId: "org_1",
        platformRole: "none",
        tenantRole: null,
      },
      set
    )

    expect(result).toEqual({
      ok: false,
      error: "FORBIDDEN",
      policyCode: "TENANT_ROLE_REQUIRED",
      message: "No valid tenant role is present for this organization.",
    })
    expect(set).toEqual({ status: 403 })
  })

  it("allows access after creator membership role is valid", () => {
    const result = ensureTenantContextAccess(
      "org_1",
      {
        userId: "user_1",
        organizationId: "org_1",
        platformRole: "none",
        tenantRole: "owner",
      },
      {}
    )

    expect(result).toBe(true)
  })
})
