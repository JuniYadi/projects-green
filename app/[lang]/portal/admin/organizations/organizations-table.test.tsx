import { describe, expect, it, mock } from "bun:test"
import React from "react"
import { render, waitFor } from "@testing-library/react"

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

const { OrganizationsTable } = await import("./organizations-table")

describe("OrganizationsTable", () => {
  it("renders organizations and only a single dedicated search input without duplicate table search", async () => {
    const view = render(<OrganizationsTable />)

    // Wait until loaded and organization name appears
    await waitFor(() => {
      expect(view.getByText("Acme Corp")).toBeInTheDocument()
    })

    // Assert that only exactly ONE search input exists on the entire page/table
    const searchInputs = view.getAllByRole("textbox")
    expect(searchInputs).toHaveLength(1)
    expect(searchInputs[0]).toHaveAttribute(
      "placeholder",
      "Search organizations..."
    )

    // Also assert directly against container query selector for input elements
    const inputs = view.container.querySelectorAll("input")
    expect(inputs).toHaveLength(1)
  })
})
