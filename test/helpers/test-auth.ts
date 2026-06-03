/**
 * Shared auth & admin test fixtures — DRY + KISS
 *
 * Eliminates duplicated MockAuthContext, defaultAuth, mockPlatformRole,
 * mockIsAdmin, and the isAdmin unit test block across billing route tests.
 */

import { describe, it, expect } from "bun:test"
import type { PlatformAccessRole } from "@/lib/platform-role"

// ── Types ──────────────────────────────────────────────

export type MockAuthContext = {
  organizationId?: string | null
  role?: string | null
  roles?: string[] | null
  user: { id: string; email?: string | null } | null
}

// ── Default values ─────────────────────────────────────

export const defaultAuth: MockAuthContext = {
  user: { id: "admin-1", email: "admin@example.com" },
  organizationId: "org-1",
  role: "owner" as const,
}

export const defaultAuthNoUser: MockAuthContext = {
  user: null,
}

export const mockPlatformRole = async () => "super_admin" as PlatformAccessRole
export const mockIsAdmin = () => true

// ── Route dependencies helper ──────────────────────────

export function createAdminRouteDeps() {
  return {
    authenticate: async () => defaultAuth as MockAuthContext,
    getPlatformRole: mockPlatformRole,
    isAdmin: mockIsAdmin,
  }
}

export function createAdminRouteDepsNoAuth() {
  return {
    authenticate: async () => defaultAuthNoUser as MockAuthContext,
    getPlatformRole: mockPlatformRole,
    isAdmin: mockIsAdmin,
  }
}

// ── isAdmin unit test block ────────────────────────────
// Shared across admin billing routes to avoid copy-paste.

export function testIsAdmin(
  isAdmin: (actor: {
    platformRole: PlatformAccessRole
    [key: string]: string | null | undefined
  }) => boolean,
  orgProp: "orgRole" | "tenantRole" = "orgRole",
) {
  const role = (v: string | null | undefined) => ({ [orgProp]: v })

  describe("defaultDeps.isAdmin", () => {
    it("returns true for super_admin with null role (the bug scenario)", () => {
      expect(isAdmin({ platformRole: "super_admin", ...role(null) })).toBe(true)
    })

    it("returns true for super_admin with undefined role", () => {
      expect(isAdmin({ platformRole: "super_admin", ...role(undefined) })).toBe(true)
    })

    it("returns true for super_admin with admin role", () => {
      expect(isAdmin({ platformRole: "super_admin", ...role("admin") })).toBe(true)
    })

    it("returns true for non-super_admin with admin role", () => {
      expect(isAdmin({ platformRole: "none", ...role("admin") })).toBe(true)
    })

    it("returns true for non-super_admin with owner role", () => {
      expect(isAdmin({ platformRole: "none", ...role("owner") })).toBe(true)
    })

    it("returns false for non-super_admin with member role", () => {
      expect(isAdmin({ platformRole: "none", ...role("member") })).toBe(false)
    })

    it("returns false for non-super_admin with null role", () => {
      expect(isAdmin({ platformRole: "none", ...role(null) })).toBe(false)
    })

    it("returns false for non-super_admin with undefined role", () => {
      expect(isAdmin({ platformRole: "none", ...role(undefined) })).toBe(false)
    })
  })
}
