import { beforeEach, describe, expect, it, mock } from "bun:test"

type WorkosOrganizationPage = {
  data: Array<{ id: string; name?: string | null }>
  listMetadata: { after?: string }
}

const mockListOrganizations = mock(
  async (): Promise<WorkosOrganizationPage> => ({
    data: [],
    listMetadata: {},
  })
)

mock.module("@workos-inc/authkit-nextjs", () => ({
  getWorkOS: mock(() => ({
    organizations: { listOrganizations: mockListOrganizations },
    userManagement: {},
  })),
}))
mock.module("@/lib/redis", () => ({ redis: null }))

const { listCachedOrganizations } = await import("./workos-directory")

describe("listCachedOrganizations", () => {
  beforeEach(() => {
    mockListOrganizations.mockClear()
    mockListOrganizations.mockImplementationOnce(async () => ({
      data: [{ id: "org-1", name: "Org One" }],
      listMetadata: { after: "cursor-1" },
    }))
    mockListOrganizations.mockImplementationOnce(async () => ({
      data: [{ id: "org-2", name: " Org Two " }],
      listMetadata: {},
    }))
  })

  it("paginates WorkOS organizations and returns directory-safe names", async () => {
    const result = await listCachedOrganizations()

    expect(result).toEqual([
      { id: "org-1", name: "Org One", slug: "org-1" },
      { id: "org-2", name: "Org Two", slug: "org-2" },
    ])
    expect(mockListOrganizations).toHaveBeenNthCalledWith(1, {
      limit: 100,
      after: undefined,
    })
    expect(mockListOrganizations).toHaveBeenNthCalledWith(2, {
      limit: 100,
      after: "cursor-1",
    })
  })
})
