import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

import { createDocsConsoleRoutes } from "./docs-console.route"

type MockPrismaKnowledgeDocument = {
  findMany: ReturnType<typeof mock>
}

type MockPrisma = {
  knowledgeDocument: MockPrismaKnowledgeDocument
}

let mockPrisma: MockPrisma

beforeEach(() => {
  mockPrisma = {
    knowledgeDocument: {
      findMany: mock(() =>
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
      ),
    },
  }
})

describe("docsConsoleRoutes", () => {
  it("GET /docs/list returns docs for the organization and global", async () => {
    // Must mock before importing the route module
    mock.module("@/lib/prisma", () => ({
      prisma: mockPrisma,
    }))
    mock.module("@workos-inc/authkit-nextjs", () => ({
      withAuth: mock(() =>
        Promise.resolve({
          user: { id: "user_1" },
          organizationId: "org_1",
        })
      ),
    }))

    const { createDocsConsoleRoutes: create } = await import(
      "./docs-console.route"
    )
    const app = create()
    const response = await app.handle(
      new Request("http://localhost/docs/list")
    )
    const data = (await response.json()) as { ok: boolean; docs: unknown[] }

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.docs).toHaveLength(2)
    expect(mockPrisma.knowledgeDocument.findMany).toHaveBeenCalled()
  })

  it("GET /docs/search returns matching docs", async () => {
    mockPrisma.knowledgeDocument.findMany = mock(() =>
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

    mock.module("@/lib/prisma", () => ({
      prisma: mockPrisma,
    }))
    mock.module("@workos-inc/authkit-nextjs", () => ({
      withAuth: mock(() =>
        Promise.resolve({
          user: { id: "user_1" },
          organizationId: "org_1",
        })
      ),
    }))

    const { createDocsConsoleRoutes: create } = await import(
      "./docs-console.route"
    )
    const app = create()
    const response = await app.handle(
      new Request("http://localhost/docs/search?q=deploy")
    )
    const data = (await response.json()) as { ok: boolean; docs: unknown[] }

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.docs).toHaveLength(1)
  })

  it("GET /docs/search returns empty when no query", async () => {
    mock.module("@/lib/prisma", () => ({
      prisma: mockPrisma,
    }))
    mock.module("@workos-inc/authkit-nextjs", () => ({
      withAuth: mock(() =>
        Promise.resolve({
          user: { id: "user_1" },
          organizationId: "org_1",
        })
      ),
    }))

    const { createDocsConsoleRoutes: create } = await import(
      "./docs-console.route"
    )
    const app = create()
    const response = await app.handle(
      new Request("http://localhost/docs/search")
    )
    const data = (await response.json()) as { ok: boolean; docs: unknown[] }

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.docs).toHaveLength(0)
    // findMany should NOT be called when q is absent
    expect(mockPrisma.knowledgeDocument.findMany).not.toHaveBeenCalled()
  })
})