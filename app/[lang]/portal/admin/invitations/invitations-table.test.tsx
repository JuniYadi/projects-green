import { describe, expect, it, mock } from "bun:test"
import React from "react"
import { InvitationsTable } from "./invitations-table"

mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: mock(() => {}),
    replace: mock(() => {}),
    prefetch: mock(() => {}),
  }),
  usePathname: () => "/en/portal/admin/invitations",
  useSearchParams: () => new URLSearchParams(),
}))

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      admin: {
        organizations: {
          get: async () => ({
            data: {
              ok: true,
              data: {
                organizations: [{ id: "org_1", name: "Acme Corp" }],
                listMetadata: {},
              },
            },
          }),
        },
        invitations: {
          get: async () => ({
            data: {
              ok: true,
              data: {
                invitations: [
                  {
                    id: "inv_1",
                    email: "invitee@example.com",
                    state: "pending",
                    organizationId: "org_1",
                    organizationName: "Acme Corp",
                    roleSlug: "member",
                    createdAt: "2026-01-01T00:00:00.000Z",
                    expiresAt: "2026-01-08T00:00:00.000Z",
                    acceptedAt: null,
                  },
                ],
                listMetadata: {},
              },
            },
          }),
          post: async () => ({
            data: {
              ok: true,
              invitation: {
                id: "inv_2",
                email: "new@example.com",
                state: "pending",
              },
            },
          }),
        },
      },
    },
  },
}))

describe("InvitationsTable", () => {
  it("renders without crashing", () => {
    const element = React.createElement(InvitationsTable)
    expect(React.isValidElement(element)).toBe(true)
  })
})
