import { describe, it, expect, mock, beforeEach } from "bun:test"

const mockListOrganizations = mock(() =>
  Promise.resolve({
    data: [],
    listMetadata: {},
  })
)

mock.module("@workos-inc/authkit-nextjs", () => ({
  getWorkOS: () => ({
    organizations: {
      listOrganizations: mockListOrganizations,
    },
  }),
}))

const { listAdminOrganizations } = await import("./admin.service")

describe("listAdminOrganizations", () => {
  beforeEach(() => {
    mockListOrganizations.mockClear()
  })

  it("calls workos.organizations.listOrganizations with params", async () => {
    await listAdminOrganizations({ limit: 10 })
    expect(mockListOrganizations).toHaveBeenCalledWith({ limit: 10 })
  })

  it("returns organizations mapped to summary format", async () => {
    mockListOrganizations.mockResolvedValue({
      data: [
        {
          id: "org_123",
          name: "Test Org",
          externalId: "ext_123",
          domains: [{ domain: "test.com", state: "verified" }],
          allowProfilesOutsideOrganization: true,
          createdAt: "2024-01-01",
          updatedAt: "2024-01-02",
        },
      ],
      listMetadata: { before: "cursor_before", after: "cursor_after" },
    })

    const result = await listAdminOrganizations({ limit: 10 })
    expect(result.organizations).toHaveLength(1)
    expect(result.organizations[0].name).toBe("Test Org")
    expect(result.organizations[0].domains).toEqual(["test.com"])
    expect(result.listMetadata?.before).toBe("cursor_before")
  })
})
