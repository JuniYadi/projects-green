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

// Mock embedDocument to return a zero-filled embedding
const mockEmbedDocument = mock(async () => new Float32Array(1536).fill(0))

mock.module("@/lib/prisma", () => ({
  prisma: {
    docsKnowledgeDocument: {
      findFirst: mockFindFirst,
      create: mockCreate,
      update: mockUpdate,
      findMany: mockFindMany,
    },
  },
}))

mock.module("@/modules/docs/docs-embedding.service", () => ({
  embedDocument: mockEmbedDocument,
  EMBEDDING_DIMENSIONS: 1536,
}))

const loadService = () => import("@/modules/docs/docs.service")

const buildRecord = (
  input: Partial<KnowledgeDocRecord> = {}
): KnowledgeDocRecord => ({
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
  mockFindFirst.mockClear()
  mockCreate.mockClear()
  mockUpdate.mockClear()
  mockFindMany.mockClear()
  mockEmbedDocument.mockClear()
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
    mockFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(
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
        searchText: "applications deployment manage events",
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

  it("returns empty array when no docs match", async () => {
    const { searchKnowledgeDocs } = await loadService()
    mockFindMany.mockResolvedValueOnce([])

    const results = await searchKnowledgeDocs({
      organizationId: "org_1",
      routePath: "/nonexistent",
      query: "nothing",
      limit: 1,
    })

    expect(results).toEqual([])
  })

  it("handles empty query string", async () => {
    const { searchKnowledgeDocs } = await loadService()
    mockFindMany.mockResolvedValueOnce([
      buildRecord({
        id: "doc_1",
        path: "/console",
        searchText: "some content",
      }),
    ])

    const results = await searchKnowledgeDocs({
      organizationId: "org_1",
      routePath: "/console",
      query: "",
      limit: 1,
    })

    // Empty query = no query tokens, so lexical score = 0
    // Route match still gives 100 for exact path match
    expect(results.length).toBe(1)
  })
})

describe("normalizeDocPath edge cases", () => {
  it("handles path with query string", async () => {
    const { normalizeDocPath } = await loadService()
    expect(normalizeDocPath("/page?foo=bar&baz=1")).toBe("/page")
  })

  it("handles path with hash fragment", async () => {
    const { normalizeDocPath } = await loadService()
    expect(normalizeDocPath("/page#section")).toBe("/page")
  })

  it("adds leading slash when missing", async () => {
    const { normalizeDocPath } = await loadService()
    expect(normalizeDocPath("page")).toBe("/page")
  })

  it("preserves single slash", async () => {
    const { normalizeDocPath } = await loadService()
    expect(normalizeDocPath("/")).toBe("/")
  })
})

describe("getDocByPath edge cases", () => {
  it("returns null for empty path after normalization", async () => {
    const { getDocByPath } = await loadService()
    const doc = await getDocByPath({
      path: "   ",
      organizationId: "org_1",
    })
    expect(doc).toBeNull()
  })
})

describe("semanticSearchKnowledgeDocs", () => {
  it("returns results using lexical fallback when embedding is not available", async () => {
    const { semanticSearchKnowledgeDocs } = await loadService()
    mockFindMany.mockResolvedValueOnce([
      buildRecord({
        id: "semantic_1",
        path: "/console",
        searchText: "deploy applications",
      }),
    ])
    mockEmbedDocument.mockRejectedValueOnce(new Error("AI not configured"))

    const results = await semanticSearchKnowledgeDocs({
      organizationId: "org_1",
      routePath: "/console",
      query: "deploy",
      limit: 1,
    })

    expect(results.length).toBeGreaterThan(0)
  })

  it("returns empty array when no candidates match", async () => {
    const { semanticSearchKnowledgeDocs } = await loadService()
    mockFindMany.mockResolvedValueOnce([])

    const results = await semanticSearchKnowledgeDocs({
      organizationId: null,
      routePath: "/console",
      query: "test",
    })

    expect(results).toEqual([])
  })
})

describe("backfillEmbeddings", () => {
  it("returns zero processed when no documents need backfill", async () => {
    const { backfillEmbeddings } = await loadService()
    mockFindMany.mockResolvedValueOnce([])

    const result = await backfillEmbeddings(50)
    expect(result.processed).toBe(0)
    expect(result.errors).toEqual([])
  })

  it("processes documents and updates embeddings", async () => {
    const { backfillEmbeddings } = await loadService()
    mockFindMany.mockResolvedValueOnce([
      buildRecord({
        id: "backfill_1",
        path: "/console",
        howTo: ["Step 1"],
        notes: ["Note 1"],
      }),
    ])
    // Second call returns empty to stop the loop
    mockFindMany.mockResolvedValueOnce([])

    const result = await backfillEmbeddings(1)
    expect(result.processed).toBe(1)
  })

  it("collects errors when embedding fails", async () => {
    const { backfillEmbeddings } = await loadService()
    mockFindMany.mockResolvedValueOnce([
      buildRecord({
        id: "fail_1",
        path: "/fail",
        howTo: [],
        notes: [],
      }),
    ])
    mockFindMany.mockResolvedValueOnce([])
    mockEmbedDocument.mockRejectedValueOnce(new Error("Embedding failed"))

    const result = await backfillEmbeddings(1)
    // Document found but embedding failed
    expect(result.processed).toBe(0)
    expect(result.errors.length).toBe(1)
    expect(result.errors[0]).toContain("fail_1")
  })
})
