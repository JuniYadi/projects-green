import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockGetUser = mock()
const mockGetOrganization = mock()

mock.module("@workos-inc/authkit-nextjs", () => ({
  getWorkOS: () => ({
    userManagement: {
      getUser: mockGetUser,
    },
    organizations: {
      getOrganization: mockGetOrganization,
    },
  }),
}))

import {
  resolveUser,
  resolveOrganization,
  resolveUsers,
  resolveOrganizations,
} from "./vouchers.name-resolver"

describe("Voucher Name Resolver", () => {
  beforeEach(() => {
    mockGetUser.mockReset()
    mockGetOrganization.mockReset()
  })

  describe("resolveUser", () => {
    it("returns empty result when userId is null or empty", async () => {
      expect(await resolveUser(null)).toEqual({ id: "", name: "" })
      expect(await resolveUser("")).toEqual({ id: "", name: "" })
      expect(mockGetUser).not.toHaveBeenCalled()
    })

    it("resolves full name when both first and last names exist", async () => {
      mockGetUser.mockResolvedValueOnce({
        id: "user_1",
        firstName: " Jane ",
        lastName: " Doe ",
        email: "jane@example.com",
      })

      const result = await resolveUser("user_1")
      expect(result).toEqual({ id: "user_1", name: "Jane Doe" })
      expect(mockGetUser).toHaveBeenCalledWith("user_1")
    })

    it("resolves first name only when last name is missing", async () => {
      mockGetUser.mockResolvedValueOnce({
        id: "user_2",
        firstName: "Jane",
        lastName: null,
        email: "jane@example.com",
      })

      const result = await resolveUser("user_2")
      expect(result).toEqual({ id: "user_2", name: "Jane" })
    })

    it("resolves last name only when first name is missing", async () => {
      mockGetUser.mockResolvedValueOnce({
        id: "user_3",
        firstName: "",
        lastName: "Doe",
        email: "doe@example.com",
      })

      const result = await resolveUser("user_3")
      expect(result).toEqual({ id: "user_3", name: "Doe" })
    })

    it("falls back to email when full name is empty", async () => {
      mockGetUser.mockResolvedValueOnce({
        id: "user_4",
        firstName: "  ",
        lastName: "",
        email: "solo@example.com",
      })

      const result = await resolveUser("user_4")
      expect(result).toEqual({ id: "user_4", name: "solo@example.com" })
    })

    it("falls back to userId when full name and email are empty", async () => {
      mockGetUser.mockResolvedValueOnce({
        id: "user_5",
        firstName: null,
        lastName: null,
        email: null,
      })

      const result = await resolveUser("user_5")
      expect(result).toEqual({ id: "user_5", name: "user_5" })
    })

    it("falls back to userId when WorkOS throws an error", async () => {
      mockGetUser.mockRejectedValueOnce(new Error("WorkOS API down"))

      const result = await resolveUser("user_error")
      expect(result).toEqual({ id: "user_error", name: "user_error" })
    })
  })

  describe("resolveOrganization", () => {
    it("returns empty result when organizationId is null or empty", async () => {
      expect(await resolveOrganization(null)).toEqual({ id: "", name: "" })
      expect(await resolveOrganization("")).toEqual({ id: "", name: "" })
      expect(mockGetOrganization).not.toHaveBeenCalled()
    })

    it("resolves organization name when available", async () => {
      mockGetOrganization.mockResolvedValueOnce({
        id: "org_1",
        name: "Acme Corp",
      })

      const result = await resolveOrganization("org_1")
      expect(result).toEqual({ id: "org_1", name: "Acme Corp" })
      expect(mockGetOrganization).toHaveBeenCalledWith("org_1")
    })

    it("falls back to organizationId when name is empty string", async () => {
      mockGetOrganization.mockResolvedValueOnce({
        id: "org_2",
        name: "",
      })

      const result = await resolveOrganization("org_2")
      expect(result).toEqual({ id: "org_2", name: "org_2" })
    })

    it("falls back to organizationId when WorkOS throws an error", async () => {
      mockGetOrganization.mockRejectedValueOnce(new Error("Org not found"))

      const result = await resolveOrganization("org_error")
      expect(result).toEqual({ id: "org_error", name: "org_error" })
    })
  })

  describe("resolveUsers", () => {
    it("deduplicates IDs and filters out null/empty values", async () => {
      mockGetUser.mockImplementation(async (id: string) => {
        if (id === "u1") {
          return { id: "u1", firstName: "Alice", email: "alice@test.com" }
        }
        if (id === "u2") {
          return { id: "u2", firstName: "Bob", email: "bob@test.com" }
        }
        return { id, firstName: id }
      })

      const result = await resolveUsers(["u1", null, "u2", "u1", "", "u2"])

      expect(mockGetUser).toHaveBeenCalledTimes(2)
      expect(result.size).toBe(2)
      expect(result.get("u1")).toEqual({ id: "u1", name: "Alice" })
      expect(result.get("u2")).toEqual({ id: "u2", name: "Bob" })
    })

    it("handles empty array", async () => {
      const result = await resolveUsers([])
      expect(result.size).toBe(0)
      expect(mockGetUser).not.toHaveBeenCalled()
    })
  })

  describe("resolveOrganizations", () => {
    it("deduplicates org IDs and filters out null/empty values", async () => {
      mockGetOrganization.mockImplementation(async (id: string) => {
        if (id === "org_1") {
          return { id: "org_1", name: "Org Alpha" }
        }
        if (id === "org_2") {
          return { id: "org_2", name: "Org Beta" }
        }
        return { id, name: id }
      })

      const result = await resolveOrganizations([
        "org_1",
        null,
        "org_2",
        "org_1",
        "",
        "org_2",
      ])

      expect(mockGetOrganization).toHaveBeenCalledTimes(2)
      expect(result.size).toBe(2)
      expect(result.get("org_1")).toEqual({ id: "org_1", name: "Org Alpha" })
      expect(result.get("org_2")).toEqual({ id: "org_2", name: "Org Beta" })
    })

    it("handles empty array", async () => {
      const result = await resolveOrganizations([])
      expect(result.size).toBe(0)
      expect(mockGetOrganization).not.toHaveBeenCalled()
    })
  })
})
