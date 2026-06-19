import { describe, it, expect, mock, beforeEach } from "bun:test"

import {
  ensureTenantContextAccess,
  getTenantActorContext,
  requireTenantActor,
} from "./tenants.guards"
import type { PlatformAccessRole } from "@/lib/platform-role"
import type { TenantRole } from "@/modules/tenants/tenant-policy"

type MockAuthResult = {
  user: { id: string; email: string } | null
  organizationId: string | null
  role: string | null
  roles: string[] | null
}

let mockAuthValue: MockAuthResult = {
  user: { id: "user-1", email: "user@test.com" },
  organizationId: null,
  role: null,
  roles: null,
}

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mock(async () => mockAuthValue),
}))

mock.module("@/lib/platform-role", () => ({
  getPlatformRoleForUser: mock(async (input: { id?: string | null }) => {
    if (input.id === "super-user") return "super_admin" as PlatformAccessRole
    return "none" as PlatformAccessRole
  }),
}))

mock.module("@/modules/tenants/tenant-policy", () => ({
  resolveTenantRoleFromClaims: mock((role: string | null) => {
    if (role === "admin" || role === "owner") return role as TenantRole
    return null
  }),
}))

const mockSet = { status: 0 as number | string }

describe("getTenantActorContext", () => {
  beforeEach(() => {
    mockAuthValue = {
      user: { id: "user-1", email: "user@test.com" },
      organizationId: null,
      role: null,
      roles: null,
    }
  })

  it("returns actor context when authenticated", async () => {
    const actor = await getTenantActorContext()
    expect(actor).not.toBeNull()
    expect(actor!.userId).toBe("user-1")
    expect(actor!.platformRole).toBe("none")
    expect(actor!.tenantRole).toBeNull()
  })

  it("returns null when no auth (user is null)", async () => {
    mockAuthValue = {
      user: null,
      organizationId: null,
      role: null,
      roles: null,
    }
    const result = await getTenantActorContext()
    expect(result).toBeNull()
  })

  it("resolves super_admin platform role", async () => {
    mockAuthValue = {
      user: { id: "super-user", email: "super@test.com" },
      organizationId: "org-1",
      role: null,
      roles: null,
    }
    const actor = await getTenantActorContext()
    expect(actor!.platformRole).toBe("super_admin")
  })

  it("resolves tenant role from auth role", async () => {
    mockAuthValue = {
      user: { id: "user-1", email: "user@test.com" },
      organizationId: "org-1",
      role: "admin",
      roles: ["admin"],
    }
    const actor = await getTenantActorContext()
    expect(actor!.tenantRole).toBe("admin")
  })

  it("passes organizationId through", async () => {
    mockAuthValue = {
      user: { id: "user-1", email: "user@test.com" },
      organizationId: "org-42",
      role: "owner",
      roles: ["owner"],
    }
    const actor = await getTenantActorContext()
    expect(actor!.organizationId).toBe("org-42")
  })
})

describe("requireTenantActor", () => {
  beforeEach(() => {
    mockSet.status = 0
    mockAuthValue = {
      user: { id: "user-1", email: "user@test.com" },
      organizationId: null,
      role: null,
      roles: null,
    }
  })

  it("returns actor when authenticated", async () => {
    const result = await requireTenantActor(mockSet)
    expect(result).not.toHaveProperty("error")
    expect((result as { userId: string }).userId).toBe("user-1")
  })

  it("returns unauthorized error when user is null", async () => {
    mockAuthValue = {
      user: null,
      organizationId: null,
      role: null,
      roles: null,
    }
    const result = await requireTenantActor(mockSet)
    expect(result).toHaveProperty("error")
    expect((result as { error: string }).error).toBe("UNAUTHORIZED")
    expect(mockSet.status).toBe(401)
  })
})

describe("ensureTenantContextAccess", () => {
  it("allows super_admin without org context", () => {
    const actor = {
      userId: "super-1",
      organizationId: null,
      platformRole: "super_admin" as PlatformAccessRole,
      tenantRole: null as TenantRole | null,
    }
    expect(ensureTenantContextAccess("any-org", actor, mockSet)).toBe(true)
  })

  it("allows user in matching org with tenant role", () => {
    const actor = {
      userId: "user-1",
      organizationId: "org-1",
      platformRole: "none" as PlatformAccessRole,
      tenantRole: "admin" as TenantRole,
    }
    expect(ensureTenantContextAccess("org-1", actor, mockSet)).toBe(true)
  })

  it("rejects when user has no organizationId", () => {
    const actor = {
      userId: "user-1",
      organizationId: null,
      platformRole: "none" as PlatformAccessRole,
      tenantRole: null as TenantRole | null,
    }
    const result = ensureTenantContextAccess("org-1", actor, mockSet)
    expect(result).toHaveProperty("error")
    expect((result as { error: string }).error).toBe("FORBIDDEN")
    expect((result as { policyCode: string }).policyCode).toBe(
      "TENANT_CONTEXT_REQUIRED"
    )
  })

  it("rejects when org does not match", () => {
    const actor = {
      userId: "user-1",
      organizationId: "org-1",
      platformRole: "none" as PlatformAccessRole,
      tenantRole: "admin" as TenantRole,
    }
    const result = ensureTenantContextAccess("org-2", actor, mockSet)
    expect(result).toHaveProperty("error")
    expect((result as { error: string }).error).toBe("FORBIDDEN")
    expect((result as { policyCode: string }).policyCode).toBe(
      "TENANT_CONTEXT_MISMATCH"
    )
  })

  it("allows when user has no tenant role but valid org (fallback to member)", () => {
    const actor = {
      userId: "user-1",
      organizationId: "org-1",
      platformRole: "none" as PlatformAccessRole,
      tenantRole: null as TenantRole | null,
    }
    const result = ensureTenantContextAccess("org-1", actor, mockSet)
    expect(result).toBe(true)
  })

  it("rejects when user has no tenant role and no org context", () => {
    const actor = {
      userId: "user-1",
      organizationId: null,
      platformRole: "none" as PlatformAccessRole,
      tenantRole: null as TenantRole | null,
    }
    const result = ensureTenantContextAccess("org-1", actor, mockSet)
    expect(result).toHaveProperty("error")
    expect((result as { error: string }).error).toBe("FORBIDDEN")
  })
})
