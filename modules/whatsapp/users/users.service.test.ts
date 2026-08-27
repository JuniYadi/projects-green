import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockListOrganizationMemberships = mock(() =>
  Promise.resolve({
    autoPagination: async () => [],
  })
)
const mockGetOrganizationMembership = mock(() => Promise.resolve(null))
const mockCreateInvitation = mock(() => Promise.resolve({}))
const mockUpdateOrganizationMembership = mock(() => Promise.resolve({}))
const mockDeleteOrganizationMembership = mock(() => Promise.resolve())

mock.module("@workos-inc/authkit-nextjs", () => ({
  getWorkOS: () => ({
    userManagement: {
      listOrganizationMemberships: mockListOrganizationMemberships,
      getOrganizationMembership: mockGetOrganizationMembership,
      sendInvitation: mockCreateInvitation,
      updateOrganizationMembership: mockUpdateOrganizationMembership,
      deleteOrganizationMembership: mockDeleteOrganizationMembership,
    },
  }),
}))

class MockNotFoundException extends Error {
  name = "NotFoundException"
}

mock.module("@workos-inc/node", () => ({
  NotFoundException: MockNotFoundException,
}))

mock.module("@/modules/tenants/tenant-policy", () => ({
  normalizeTenantRole: (slug: string) => slug || "member",
}))

import {
  getWhatsAppUser,
  inviteWhatsAppUser,
  listWhatsAppUsers,
  removeWhatsAppUser,
  updateWhatsAppUserRole,
} from "./users.service"

describe("whatsapp users.service", () => {
  beforeEach(() => {
    mockListOrganizationMemberships.mockClear()
    mockGetOrganizationMembership.mockClear()
    mockCreateInvitation.mockClear()
    mockUpdateOrganizationMembership.mockClear()
    mockDeleteOrganizationMembership.mockClear()
  })

  describe("listWhatsAppUsers", () => {
    it("lists users and formats them into WhatsAppUser DTO", async () => {
      mockListOrganizationMemberships.mockResolvedValueOnce({
        autoPagination: async () => [
          {
            id: "mem-1",
            userId: "usr-1",
            organizationId: "org-1",
            role: { slug: "admin" },
            user: {
              email: "admin@example.com",
              firstName: "Admin",
              lastName: "User",
            },
            status: "active",
            createdAt: "2026-08-28T00:00:00.000Z",
            updatedAt: "2026-08-28T00:00:00.000Z",
          },
        ],
      } as unknown as never)

      const users = await listWhatsAppUsers("org-1")

      expect(users).toHaveLength(1)
      expect(users[0]).toEqual({
        id: "mem-1",
        userId: "usr-1",
        organizationId: "org-1",
        email: "admin@example.com",
        displayName: "Admin User",
        avatarUrl: null,
        role: "admin",
        roleSlug: "admin",
        status: "active",
        createdAt: "2026-08-28T00:00:00.000Z",
        updatedAt: "2026-08-28T00:00:00.000Z",
      })
    })
  })

  describe("getWhatsAppUser", () => {
    it("returns null if membership not found", async () => {
      const notFoundErr = new MockNotFoundException("Not found")
      mockGetOrganizationMembership.mockRejectedValueOnce(notFoundErr)

      const user = await getWhatsAppUser("mem-404")

      expect(user).toBeNull()
    })

    it("returns mapped user when found", async () => {
      mockGetOrganizationMembership.mockResolvedValueOnce({
        id: "mem-1",
        userId: "usr-1",
        organizationId: "org-1",
        role: { slug: "member" },
        user: { email: "member@example.com" },
        status: "active",
        createdAt: "2026-08-28T00:00:00.000Z",
        updatedAt: "2026-08-28T00:00:00.000Z",
      } as unknown as never)

      const user = await getWhatsAppUser("mem-1")

      expect(user?.email).toBe("member@example.com")
      expect(user?.role).toBe("member")
    })
  })

  describe("inviteWhatsAppUser", () => {
    it("sends invitation via WorkOS", async () => {
      mockCreateInvitation.mockResolvedValueOnce({
        id: "inv-1",
        email: "new@example.com",
        roleSlug: "user_member",
      } as unknown as never)

      const res = await inviteWhatsAppUser({
        organizationId: "org-1",
        email: "new@example.com",
        role: "member",
        inviterUserId: "usr-inviter",
      })

      expect(res).toEqual({
        id: "inv-1",
        email: "new@example.com",
        roleSlug: "user_member",
      })
    })
  })

  describe("updateWhatsAppUserRole", () => {
    it("updates role and returns mapped user", async () => {
      mockUpdateOrganizationMembership.mockResolvedValueOnce({
        id: "mem-1",
        userId: "usr-1",
        organizationId: "org-1",
        role: { slug: "admin" },
        user: { email: "user@example.com" },
        status: "active",
        createdAt: "2026-08-28T00:00:00.000Z",
        updatedAt: "2026-08-28T00:00:00.000Z",
      } as unknown as never)

      const updated = await updateWhatsAppUserRole("mem-1", "admin")

      expect(updated.role).toBe("admin")
    })
  })

  describe("removeWhatsAppUser", () => {
    it("deletes organization membership", async () => {
      await removeWhatsAppUser("mem-1")

      expect(mockDeleteOrganizationMembership).toHaveBeenCalledWith("mem-1")
    })
  })
})
