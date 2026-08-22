import { beforeEach, describe, expect, it, mock } from "bun:test"

import { searchHybridKnowledge } from "./ai-rag.service"

// Mock Prisma
const mockFindMany = mock(async () => [])

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
})
