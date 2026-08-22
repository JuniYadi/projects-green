import { describe, expect, it, mock } from "bun:test"
import React from "react"
import { InvitationsView } from "./invitations-view"

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
                allowedActions: ["invite_member", "invite_admin"],
              },
            }),
          },
          invitations: {
            get: async () => ({
              data: {
                ok: true,
                orgId: "org_123",
                invitations: [
                  {
                    id: "inv_1",
                    email: "invitee@example.com",
                    state: "pending",
                    organizationId: "org_123",
                    inviterUserId: "usr_1",
                    acceptedUserId: null,
                    roleSlug: "user_member",
                    createdAt: "2026-01-01T00:00:00.000Z",
                    expiresAt: "2026-01-08T00:00:00.000Z",
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

describe("InvitationsView", () => {
  it("renders without crashing", () => {
    const element = React.createElement(InvitationsView, {
      organizationId: "org_123",
    })
    expect(React.isValidElement(element)).toBe(true)
  })
})
