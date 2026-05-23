import { beforeEach, describe, expect, it, mock } from "bun:test"

type KnowledgeDocRecord = {
  id: string
  organizationId: string | null
  path: string
  title: string
  purpose: string
  howTo: string[]
  notes: string[]
  searchText: string
  updatedByWorkosUserId: string
  createdAt: Date
  updatedAt: Date
}

const mockFindFirst = mock(async () => null as KnowledgeDocRecord | null)
const mockCreate = mock(async () => null as unknown as KnowledgeDocRecord)
const mockUpdate = mock(async () => null as unknown as KnowledgeDocRecord)
const mockFindMany = mock(async () => [] as KnowledgeDocRecord[])

mock.module("@/lib/prisma", () => ({
  prisma: {
    knowledgeDocument: {
      findFirst: mockFindFirst,
      create: mockCreate,
      update: mockUpdate,
      findMany: mockFindMany,
    },
  },
}))

const loadService = () => import("@/modules/docs/docs.service")

const buildRecord = (input: Partial<KnowledgeDocRecord> = {}): KnowledgeDocRecord => ({
  id: input.id ?? "kdoc_1",
  organizationId: input.organizationId ?? null,
  path: input.path ?? "/console",
  title: input.title ?? "Console Overview",
  purpose: input.purpose ?? "Console purpose",
  howTo: input.howTo ?? ["Open console"],
  notes: input.notes ?? ["note"],
  searchText: input.searchText ?? "console overview",
  updatedByWorkosUserId: input.updatedByWorkosUserId ?? "user_1",
  createdAt: input.createdAt ?? new Date("2026-05-20T00:00:00.000Z"),
  updatedAt: input.updatedAt ?? new Date("2026-05-22T00:00:00.000Z"),
})

beforeEach(() => {
  mockFindFirst.mockReset()
  mockCreate.mockReset()
  mockUpdate.mockReset()
  mockFindMany.mockReset()
})

describe("normalizeDocPath", () => {
  it("normalizes path format and strips query/hash/trailing slash", async () => {
    const { normalizeDocPath } = await loadService()

    expect(normalizeDocPath(" console?page=1#overview ")).toBe("/console")
    expect(normalizeDocPath("/portal/documentations/")).toBe(
      "/portal/documentations"
    )
    expect(normalizeDocPath("/")).toBe("/")
  })

  it("returns empty string when path is blank", async () => {
    const { normalizeDocPath } = await loadService()

    expect(normalizeDocPath("   ")).toBe("")
  })
})

describe("getDocByPath", () => {
  it("prefers organization-specific docs before global docs", async () => {
    const { getDocByPath } = await loadService()
    mockFindFirst.mockResolvedValueOnce(
      buildRecord({
        organizationId: "org_1",
        title: "Org Console",
      })
    )

    const doc = await getDocByPath({
      path: "/console",
      organizationId: "org_1",
    })

    expect(doc?.title).toBe("Org Console")
    expect(mockFindFirst).toHaveBeenCalledTimes(1)
  })

  it("falls back to global docs when org-specific docs do not exist", async () => {
    const { getDocByPath } = await loadService()
    mockFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        buildRecord({
          organizationId: null,
          title: "Global Console",
        })
      )

    const doc = await getDocByPath({
      path: "/console",
      organizationId: "org_1",
    })

    expect(doc?.title).toBe("Global Console")
    expect(mockFindFirst).toHaveBeenCalledTimes(2)
  })
})

describe("upsertDocByPath", () => {
  it("updates existing doc when org/path already exists", async () => {
    const { upsertDocByPath } = await loadService()
    mockFindFirst.mockResolvedValueOnce(
      buildRecord({
        id: "kdoc_existing",
        organizationId: "org_1",
        path: "/console",
      })
    )
    mockUpdate.mockResolvedValueOnce(
      buildRecord({
        id: "kdoc_existing",
        organizationId: "org_1",
        path: "/console",
        title: "Updated Console",
      })
    )

    const saved = await upsertDocByPath({
      organizationId: "org_1",
      path: "/console",
      title: "Updated Console",
      purpose: "New purpose",
      howTo: ["Step 1"],
      notes: ["Note A"],
      updatedByWorkosUserId: "user_1",
    })

    expect(saved.title).toBe("Updated Console")
    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockCreate).toHaveBeenCalledTimes(0)
  })

  it("creates new doc when org/path does not exist", async () => {
    const { upsertDocByPath } = await loadService()
    mockFindFirst.mockResolvedValueOnce(null)
    mockCreate.mockResolvedValueOnce(
      buildRecord({
        id: "kdoc_new",
        organizationId: "org_1",
        path: "/console/app",
      })
    )

    const saved = await upsertDocByPath({
      organizationId: "org_1",
      path: "/console/app",
      title: "App Console",
      purpose: "Manage apps",
      howTo: ["Deploy app"],
      notes: [],
      updatedByWorkosUserId: "user_1",
    })

    expect(saved.path).toBe("/console/app")
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })
})

describe("searchKnowledgeDocs", () => {
  it("prioritizes route-specific docs before lexical fallback", async () => {
    const { searchKnowledgeDocs } = await loadService()
    mockFindMany.mockResolvedValueOnce([
      buildRecord({
        id: "route_doc",
        path: "/console/app/deploy",
        searchText: "applications deployment manage monitoring",
      }),
      buildRecord({
        id: "lexical_doc",
        path: "/console",
        searchText: "billing invoices and payment workflow",
      }),
    ])

    const results = await searchKnowledgeDocs({
      organizationId: "org_1",
      routePath: "/console/app/deploy",
      query: "How do I deploy and monitor?",
      limit: 2,
    })

    expect(results[0]?.id).toBe("route_doc")
    expect(results.length).toBeGreaterThan(0)
  })
})
