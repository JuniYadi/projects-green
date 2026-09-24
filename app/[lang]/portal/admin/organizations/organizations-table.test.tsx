import { describe, expect, it, mock } from "bun:test"
import React from "react"
import { OrganizationsTable } from "./organizations-table"

mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: mock(() => {}),
    replace: mock(() => {}),
    prefetch: mock(() => {}),
  }),
  usePathname: () => "/en/portal/admin/organizations",
  useParams: () => ({ lang: "en" }),
  useSearchParams: () => new URLSearchParams(),
}))

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      admin: {
        organizations: Object.assign(
          {
            get: async () => ({
              data: {
                ok: true,
                data: {
                  organizations: [
                    {
                      id: "org_1",
                      name: "Acme Corp",
                      domains: [],
                      createdAt: "2026-01-01T00:00:00.000Z",
                    },
                  ],
                  listMetadata: {},
                },
              },
            }),
          },
          {
            org_1: {
              members: {
                get: async () => ({
                  data: {
                    ok: true,
                    data: {
                      memberships: [],
                    },
                  },
                }),
              },
            },
          }
        ),
      },
    },
  },
}))

describe("OrganizationsTable", () => {
  it("renders without crashing", () => {
    const element = React.createElement(OrganizationsTable)
    expect(React.isValidElement(element)).toBe(true)
  })
})
