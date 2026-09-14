import { describe, expect, it, mock } from "bun:test"
import React from "react"
import { UsersTable } from "./users-table"

mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: mock(() => {}),
    replace: mock(() => {}),
    prefetch: mock(() => {}),
  }),
  usePathname: () => "/en/portal/admin/users",
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
        users: {
          get: async () => ({
            data: {
              ok: true,
              data: {
                users: [
                  {
                    id: "user_1",
                    email: "alice@example.com",
                    firstName: "Alice",
                    lastName: "Smith",
                    emailVerified: true,
                    profilePictureUrl: null,
                    lastSignInAt: "2026-01-01T00:00:00.000Z",
                    createdAt: "2026-01-01T00:00:00.000Z",
                    updatedAt: "2026-01-01T00:00:00.000Z",
                  },
                ],
                listMetadata: {},
              },
            },
          }),
        },
      },
    },
  },
}))

describe("UsersTable", () => {
  it("renders without crashing", () => {
    const element = React.createElement(UsersTable)
    expect(React.isValidElement(element)).toBe(true)
  })
})
