import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockFindMany = mock(() =>
  Promise.resolve([
    {
      id: "1",
      path: "/test",
      title: "Test Doc",
      updatedAt: new Date("2026-05-20"),
      organizationId: "org_1",
      searchText: "test",
    },
    {
      id: "2",
      path: "/global",
      title: "Global Doc",
      updatedAt: new Date("2026-05-21"),
      organizationId: null,
      searchText: "global",
    },
  ])
)

mock.module("@/lib/prisma", () => ({
  prisma: {
    docsKnowledgeDocument: {
      findMany: mockFindMany,
    },
  },
}))

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mock(() =>
    Promise.resolve({
      user: { id: "user_1" },
      organizationId: "org_1",
    })
  ),
}))

const { createDocsConsoleRoutes } = await import("./docs-console.route")

beforeEach(() => {
  mockFindMany.mockClear()
  mockFindMany.mockImplementation(() =>
    Promise.resolve([
      {
        id: "1",
        path: "/test",
        title: "Test Doc",
        updatedAt: new Date("2026-05-20"),
        organizationId: "org_1",
        searchText: "test",
      },
      {
        id: "2",
        path: "/global",
        title: "Global Doc",
        updatedAt: new Date("2026-05-21"),
        organizationId: null,
        searchText: "global",
      },
    ])
  )
})

describe("docsConsoleRoutes", () => {
  it("GET /docs/list returns docs for the organization and global", async () => {
    const app = createDocsConsoleRoutes()
    const response = await app.handle(
      new Request("http://localhost/docs/list")
    )
    const data = (await response.json()) as { ok: boolean; docs: unknown[] }

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.docs).toHaveLength(2)
    expect(mockFindMany).toHaveBeenCalled()
  })

  it("GET /docs/search returns matching docs", async () => {
    mockFindMany.mockImplementationOnce(() =>
      Promise.resolve([
        {
          id: "3",
          path: "/test-deploy",
          title: "Deploy Guide",
          updatedAt: new Date("2026-05-22"),
          organizationId: null,
          searchText: "deploy guide",
        },
      ])
    )

    const app = createDocsConsoleRoutes()
    const response = await app.handle(
      new Request("http://localhost/docs/search?q=deploy")
    )
    const data = (await response.json()) as { ok: boolean; docs: unknown[] }

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.docs).toHaveLength(1)
  })

  it("GET /docs/search returns empty when no query", async () => {
    const app = createDocsConsoleRoutes()
    const response = await app.handle(
      new Request("http://localhost/docs/search")
    )
    const data = (await response.json()) as { ok: boolean; docs: unknown[] }

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.docs).toHaveLength(0)
    // findMany should NOT be called when q is absent
    expect(mockFindMany).not.toHaveBeenCalled()
  })
})