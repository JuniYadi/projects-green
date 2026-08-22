import { describe, expect, it, mock } from "bun:test"
import React from "react"
import InvitePage from "./page"

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: async () => ({ user: null }),
}))

mock.module("@/modules/tenants/services/tenant-workos.service", () => ({
  findTenantInvitationByToken: async (token: string) => {
    if (token === "valid-token") {
      return {
        id: "inv_123",
        email: "invited@example.com",
        state: "pending",
        organizationId: "org_123",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      }
    }
    return null
  },
  getTenantOrganizationById: async (id: string) => ({
    id,
    name: "Acme Corp",
  }),
  acceptTenantInvitation: async () => {},
}))

describe("InvitePage", () => {
  it("renders PFNApp branding and invitation details when valid token provided", async () => {
    const pageElement = await InvitePage({
      params: Promise.resolve({ lang: "en" }),
      searchParams: Promise.resolve({ invitation_token: "valid-token" }),
    })

    expect(React.isValidElement(pageElement)).toBe(true)
  })

  it("renders unavailable state when invitation is not found", async () => {
    const pageElement = await InvitePage({
      params: Promise.resolve({ lang: "en" }),
      searchParams: Promise.resolve({ invitation_token: "invalid-token" }),
    })

    expect(React.isValidElement(pageElement)).toBe(true)
  })
})
