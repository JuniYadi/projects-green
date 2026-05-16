import { describe, expect, it } from "bun:test"

import {
  TENANT_ACTIONS,
  buildAllowedActions,
  canDemoteFromRole,
  canInviteAsRole,
  canManageTenant,
  canPromoteToRole,
  canTransferOwnership,
  normalizeTenantRole,
  resolveTenantRoleFromClaims,
} from "@/modules/tenants/tenant-policy"

describe("normalizeTenantRole", () => {
  it("normalizes known roles and user alias", () => {
    expect(normalizeTenantRole("owner")).toBe("owner")
    expect(normalizeTenantRole(" ADMIN ")).toBe("admin")
    expect(normalizeTenantRole("member")).toBe("member")
    expect(normalizeTenantRole("user")).toBe("member")
  })

  it("returns null for unknown and empty roles", () => {
    expect(normalizeTenantRole("")).toBeNull()
    expect(normalizeTenantRole("   ")).toBeNull()
    expect(normalizeTenantRole("viewer")).toBeNull()
    expect(normalizeTenantRole(undefined)).toBeNull()
    expect(normalizeTenantRole(null)).toBeNull()
  })
})

describe("resolveTenantRoleFromClaims", () => {
  it("prioritizes owner over admin/member", () => {
    expect(resolveTenantRoleFromClaims("member", ["admin", "owner"])).toBe(
      "owner"
    )
  })

  it("prioritizes admin when owner is not present", () => {
    expect(resolveTenantRoleFromClaims("member", ["admin"])).toBe("admin")
  })

  it("resolves member from alias user", () => {
    expect(resolveTenantRoleFromClaims("user", [])).toBe("member")
  })

  it("returns null when no valid roles exist", () => {
    expect(resolveTenantRoleFromClaims("viewer", ["guest"])).toBeNull()
  })
})

describe("tenant permissions", () => {
  it("allows super_admin bypass across policy checks", () => {
    const actor = { platformRole: "super_admin" as const, tenantRole: null }

    expect(canManageTenant(actor)).toBe(true)
    expect(canInviteAsRole(actor, "owner")).toBe(true)
    expect(canPromoteToRole(actor, "owner")).toBe(true)
    expect(canDemoteFromRole(actor, "owner")).toBe(true)
    expect(canTransferOwnership(actor)).toBe(true)
    expect(buildAllowedActions(actor)).toEqual([...TENANT_ACTIONS])
  })

  it("enforces manage/invite/promote/demote/transfer rules by tenant role", () => {
    const owner = { platformRole: "none" as const, tenantRole: "owner" as const }
    const admin = { platformRole: "none" as const, tenantRole: "admin" as const }
    const member = {
      platformRole: "none" as const,
      tenantRole: "member" as const,
    }

    expect(canManageTenant(owner)).toBe(true)
    expect(canManageTenant(admin)).toBe(true)
    expect(canManageTenant(member)).toBe(false)

    expect(canInviteAsRole(owner, "owner")).toBe(true)
    expect(canInviteAsRole(admin, "owner")).toBe(false)
    expect(canInviteAsRole(admin, "member")).toBe(true)

    expect(canPromoteToRole(owner, "owner")).toBe(true)
    expect(canPromoteToRole(admin, "owner")).toBe(false)
    expect(canPromoteToRole(admin, "admin")).toBe(true)

    expect(canDemoteFromRole(owner, "owner")).toBe(true)
    expect(canDemoteFromRole(admin, "owner")).toBe(false)
    expect(canDemoteFromRole(admin, "admin")).toBe(true)

    expect(canTransferOwnership(owner)).toBe(true)
    expect(canTransferOwnership(admin)).toBe(false)
    expect(canTransferOwnership(member)).toBe(false)
  })

  it("builds role-specific action lists", () => {
    expect(
      buildAllowedActions({ platformRole: "none", tenantRole: "owner" })
    ).toEqual([
      "manage_tenant",
      "invite_member",
      "invite_admin",
      "invite_owner",
      "promote_member",
      "promote_owner",
      "demote_admin",
      "demote_owner",
      "transfer_ownership",
    ])

    expect(
      buildAllowedActions({ platformRole: "none", tenantRole: "admin" })
    ).toEqual([
      "manage_tenant",
      "invite_member",
      "promote_member",
      "demote_admin",
    ])

    expect(
      buildAllowedActions({ platformRole: "none", tenantRole: "member" })
    ).toEqual([])
  })
})
