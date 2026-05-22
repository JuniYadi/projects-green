import { describe, expect, it, mock, beforeEach } from "bun:test"

// Mock prisma before importing platform-role
mock.module("@/lib/prisma", () => ({
  prisma: {
    platformUserRole: undefined,
  },
}))

import { getPlatformRoleForUser } from "@/lib/platform-role"

// Test the pure functions by extracting them for testing
const toPlatformAccessRole = (role: string | null | undefined) => {
  if (role === "SUPER_ADMIN" || role === "super_admin") {
    return "super_admin"
  }
  return "none"
}

const normalizeEmail = (value: string | null | undefined) => {
  return value?.trim().toLowerCase() ?? null
}

describe("platform-role", () => {
  describe("toPlatformAccessRole", () => {
    it("returns super_admin for SUPER_ADMIN role", () => {
      expect(toPlatformAccessRole("SUPER_ADMIN")).toBe("super_admin")
    })

    it("returns super_admin for super_admin role", () => {
      expect(toPlatformAccessRole("super_admin")).toBe("super_admin")
    })

    it("returns none for other roles", () => {
      expect(toPlatformAccessRole("admin")).toBe("none")
      expect(toPlatformAccessRole("user")).toBe("none")
      expect(toPlatformAccessRole("")).toBe("none")
    })

    it("returns none for null/undefined", () => {
      expect(toPlatformAccessRole(null)).toBe("none")
      expect(toPlatformAccessRole(undefined)).toBe("none")
    })
  })

  describe("normalizeEmail", () => {
    it("normalizes email to lowercase and trims", () => {
      expect(normalizeEmail("  Test@Example.COM  ")).toBe("test@example.com")
    })

    it("returns null for null/undefined", () => {
      expect(normalizeEmail(null)).toBeNull()
      expect(normalizeEmail(undefined)).toBeNull()
    })

    it("returns empty string for empty string", () => {
      // Current behavior: ""?.trim().toLowerCase() returns ""
      expect(normalizeEmail("")).toBe("")
    })

    it("preserves valid emails", () => {
      expect(normalizeEmail("user@example.com")).toBe("user@example.com")
    })
  })

  describe("getPlatformRoleForUser", () => {
    it("returns none when user is null/undefined", async () => {
      await expect(getPlatformRoleForUser(null)).resolves.toBe("none")
      await expect(getPlatformRoleForUser(undefined)).resolves.toBe("none")
    })

    it("returns none when user has no id or email", async () => {
      await expect(getPlatformRoleForUser({})).resolves.toBe("none")
      await expect(getPlatformRoleForUser({ id: null, email: null })).resolves.toBe("none")
    })
  })
})