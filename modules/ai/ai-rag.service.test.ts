import { beforeEach, describe, expect, it, mock } from "bun:test"

import { searchHybridKnowledge } from "./ai-rag.service"

type AnyFn = (...args: unknown[]) => Promise<unknown>

// Mock Prisma
const mockFindMany = mock<AnyFn>(async () => [])

mock.module("@/lib/prisma", () => ({
  prisma: {
    aiKnowledgeDocument: {
      findMany: mockFindMany,
    },
  },
}))

describe("aiRagService", () => {
  beforeEach(() => {
    mockFindMany.mockReset()
  })

  it("executes hybrid search and returns strictly Top-3 ranked documents", async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: "doc_1",
        title: "Kebijakan Retur Toko",
        category: "SOP",
        contentMarkdown: "Barang cacat dapat diretur maksimal 3 hari kerja.",
        searchText: "kebijakan retur barang cacat pengembalian",
        status: "READY",
        updatedAt: new Date(),
      },
      {
        id: "doc_2",
        title: "Daftar Harga & Ongkir",
        category: "Pricelist",
        contentMarkdown: "Ongkir JABODETABEK flat Rp 10.000.",
        searchText: "daftar harga ongkir pengiriman",
        status: "READY",
        updatedAt: new Date(),
      },
      {
        id: "doc_3",
        title: "Jam Operasional CS",
        category: "FAQ",
        contentMarkdown: "Senin - Sabtu pukul 08:00 - 17:00 WIB.",
        searchText: "jam kerja operasional customer service",
        status: "READY",
        updatedAt: new Date(),
      },
      {
        id: "doc_4",
        title: "Panduan Reseller",
        category: "Partnership",
        contentMarkdown: "Diskon 20% untuk minimum pembelian 10 lusin.",
        searchText: "reseller grosir kemitraan",
        status: "READY",
        updatedAt: new Date(),
      },
    ] as never)

    const results = await searchHybridKnowledge({
      organizationId: "org_1",
      query: "bagaimana cara retur barang cacat?",
      limit: 3,
    })

    expect(results.length).toBeLessThanOrEqual(3)
    expect(results[0]?.id).toBe("doc_1")
    expect(results[0]?.title).toBe("Kebijakan Retur Toko")
    expect(results[0]?.rrfScore).toBeGreaterThan(0)
  })

  it("returns empty array when query is empty", async () => {
    const results = await searchHybridKnowledge({
      organizationId: "org_1",
      query: "   ",
    })

    expect(results).toEqual([])
  })

  it("excludes another agent's docs and includes own plus org-level docs", async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: "doc_a",
        title: "Katalog Agent A",
        category: "Produk",
        contentMarkdown: "Katalog khusus agent A.",
        searchText: "katalog agent a produk",
        status: "READY",
        organizationId: "org_1",
        agentProfileId: "agent_a",
        updatedAt: new Date(),
      },
      {
        id: "doc_org",
        title: "Kebijakan Umum Toko",
        category: "SOP",
        contentMarkdown: "Kebijakan berlaku untuk semua agent di org ini.",
        searchText: "kebijakan umum toko org",
        status: "READY",
        organizationId: "org_1",
        agentProfileId: null,
        updatedAt: new Date(),
      },
    ] as never)

    const results = await searchHybridKnowledge({
      organizationId: "org_1",
      agentProfileId: "agent_a",
      query: "kebijakan katalog",
      limit: 3,
    })

    const where = (mockFindMany.mock.calls[0]?.[0] as Record<string, unknown>)
      ?.where
    expect(where).toEqual({
      status: "READY",
      OR: [
        { organizationId: "org_1", agentProfileId: "agent_a" },
        { organizationId: "org_1", agentProfileId: null },
        { organizationId: null, agentProfileId: null },
      ],
    })

    const ids = results.map((doc) => doc.id)
    expect(ids).toContain("doc_a")
    expect(ids).toContain("doc_org")
    expect(ids).not.toContain("doc_b")
  })

  it("falls back to org and global docs when agentProfileId is not provided", async () => {
    mockFindMany.mockResolvedValueOnce([])

    await searchHybridKnowledge({
      organizationId: "org_1",
      query: "jam operasional",
    })

    const where = (mockFindMany.mock.calls[0]?.[0] as Record<string, unknown>)
      ?.where
    expect(where).toEqual({
      status: "READY",
      OR: [{ organizationId: "org_1" }, { organizationId: null }],
    })

    mockFindMany.mockResolvedValueOnce([])

    await searchHybridKnowledge({
      organizationId: "org_1",
      agentProfileId: null,
      query: "jam operasional",
    })

    const whereWithNullAgent = (
      mockFindMany.mock.calls[1]?.[0] as Record<string, unknown>
    )?.where
    expect(whereWithNullAgent).toEqual({
      status: "READY",
      OR: [{ organizationId: "org_1" }, { organizationId: null }],
    })
  })
})
