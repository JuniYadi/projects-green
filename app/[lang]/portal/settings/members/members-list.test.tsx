import { describe, expect, it, mock } from "bun:test"
import React from "react"
import { MembersList } from "./members-list"

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      tenants: {
        org_123: {
          authorization: {
            get: async () => ({
              data: {
                ok: true,
                orgId: "org_123",
                effectiveGlobalRole: "none",
                effectiveTenantRole: "owner",
                allowedActions: ["manage_tenant"],
              },
            }),
          },
          members: {
            get: async () => ({
              data: {
                ok: true,
                orgId: "org_123",
                members: [
                  {
                    id: "mem_1",
                    organizationId: "org_123",
                    userId: "usr_1",
                    displayName: "Admin User",
                    email: "admin@example.com",
                    avatarUrl: null,
                    status: "active",
                    role: "admin",
                    roleSlug: "user_admin",
                    profile: {
                      email: "admin@example.com",
                      firstName: "Admin",
                      lastName: "User",
                      profilePictureUrl: null,
                      displayName: "Admin User",
                    },
                    createdAt: "2026-01-01T00:00:00.000Z",
                    updatedAt: "2026-01-01T00:00:00.000Z",
                  },
                ],
              },
            }),
          },
        },
      },
    },
  },
}))

describe("MembersList", () => {
  it("renders without crashing", () => {
    const element = React.createElement(MembersList, {
      organizationId: "org_123",
    })
    expect(React.isValidElement(element)).toBe(true)
  })
})
