import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockFindMany = mock(async (): Promise<unknown[]> => [])
const mockFindFirst = mock(async (): Promise<unknown> => null)
const mockUpdateMany = mock(async () => ({ count: 1 }))

const mockPrisma = {
  billingInvoice: {
    findMany: mockFindMany,
    findFirst: mockFindFirst,
    updateMany: mockUpdateMany,
  },
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

const { createPrismaInvoiceRepository } =
  await import("@/modules/invoices/invoices.repository")

const baseInvoice = {
  id: "inv_1",
  billingAccountId: "ba_1",
  subscriptionId: null,
  billingRunId: null,
  invoiceNumber: "INV-2026-0001",
  periodStart: new Date("2026-05-01T00:00:00.000Z"),
  periodEnd: new Date("2026-05-31T23:59:59.000Z"),
  currency: "USD",
  status: "OPEN" as const,
  subtotalAmount: 100,
  taxAmount: 10,
  discountAmount: 0,
  totalAmount: 110,
  issuedAt: new Date("2026-05-02T00:00:00.000Z"),
  dueAt: new Date("2026-05-17T00:00:00.000Z"),
  paidAt: null,
  metadataJson: null,
  createdAt: new Date("2026-05-02T00:00:00.000Z"),
  updatedAt: new Date("2026-05-02T00:00:00.000Z"),
}

const baseLine = {
  id: "line_1",
  invoiceId: "inv_1",
  lineType: "SUBSCRIPTION" as const,
  description: "Pro Plan",
  quantity: 1,
  unitPrice: 100,
  amount: 100,
  currency: "USD",
  periodStart: null,
  periodEnd: null,
  metadataJson: null,
  createdAt: new Date("2026-05-02T00:00:00.000Z"),
  updatedAt: new Date("2026-05-02T00:00:00.000Z"),
}

describe("createPrismaInvoiceRepository", () => {
  let repo: ReturnType<typeof createPrismaInvoiceRepository>

  beforeEach(() => {
    mockFindMany.mockClear()
    mockFindFirst.mockClear()
    mockUpdateMany.mockClear()
    repo = createPrismaInvoiceRepository()
  })

  describe("listByOrganization", () => {
    it("returns invoices with default sort by issuedAt desc", async () => {
      mockFindMany.mockResolvedValue([baseInvoice])

      const result = await repo.listByOrganization({
        organizationId: "org_1",
        query: {},
      })

      expect(result).toHaveLength(1)
      expect(result[0]?.invoiceNumber).toBe("INV-2026-0001")
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ issuedAt: "desc" }, { createdAt: "desc" }],
          take: 200,
        })
      )
    })

    it("filters by search query with case-insensitive contains", async () => {
      mockFindMany.mockResolvedValue([baseInvoice])

      await repo.listByOrganization({
        organizationId: "org_1",
        query: { search: "INV-2026" },
      })

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            invoiceNumber: {
              contains: "INV-2026",
              mode: "insensitive",
            },
          }),
        })
      )
    })

    it("filters by status using mapped prisma status", async () => {
      mockFindMany.mockResolvedValue([baseInvoice])

      await repo.listByOrganization({
        organizationId: "org_1",
        query: { status: "open" },
      })

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "OPEN",
          }),
        })
      )
    })

    it("builds billingAccount organization filter", async () => {
      mockFindMany.mockResolvedValue([baseInvoice])

      await repo.listByOrganization({
        organizationId: "org_1",
        query: {},
      })

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            billingAccount: {
              organizationId: "org_1",
            },
          }),
        })
      )
    })

    it("maps sortBy and sortDir correctly", async () => {
      mockFindMany.mockResolvedValue([baseInvoice])

      await repo.listByOrganization({
        organizationId: "org_1",
        query: {
          sortBy: "totalAmount",
          sortDir: "asc",
        },
      })

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ totalAmount: "asc" }, { createdAt: "desc" }],
        })
      )
    })

    it("defaults to invoiceNumber for unknown sortBy values", async () => {
      mockFindMany.mockResolvedValue([baseInvoice])

      await repo.listByOrganization({
        organizationId: "org_1",
        query: {
          sortBy: "unknownField" as never,
        },
      })

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ invoiceNumber: "desc" }, { createdAt: "desc" }],
        })
      )
    })

    it("returns empty array when no invoices match", async () => {
      mockFindMany.mockResolvedValue([])

      const result = await repo.listByOrganization({
        organizationId: "org_nonexistent",
        query: {},
      })

      expect(result).toEqual([])
    })

    it("does not include billingAccount filter when organizationId is null", async () => {
      mockFindMany.mockResolvedValue([baseInvoice])

      await repo.listByOrganization({
        organizationId: null,
        query: {},
      })

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        })
      )
    })

    it("sorts by status field when specified", async () => {
      mockFindMany.mockResolvedValue([baseInvoice])

      await repo.listByOrganization({
        organizationId: "org_1",
        query: {
          sortBy: "status",
          sortDir: "asc",
        },
      })

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        })
      )
    })
  })

  describe("findByIdForOrganization", () => {
    it("returns invoice detail with lines when found", async () => {
      const invoiceWithLines = {
        ...baseInvoice,
        lines: [baseLine],
      }
      mockFindFirst.mockResolvedValue(invoiceWithLines)

      const result = await repo.findByIdForOrganization({
        organizationId: "org_1",
        invoiceId: "inv_1",
      })

      expect(result).not.toBeNull()
      expect(result?.invoiceNumber).toBe("INV-2026-0001")
      expect(result?.lines).toHaveLength(1)
      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ id: "inv_1" }),
            ]),
          }),
          include: expect.objectContaining({
            lines: expect.objectContaining({
              orderBy: expect.arrayContaining([
                { periodStart: "asc" },
                { createdAt: "asc" },
              ]),
            }),
          }),
        })
      )
    })

    it("looks up by invoiceNumber as well as id", async () => {
      mockFindFirst.mockResolvedValue(null)
      await repo.findByIdForOrganization({
        organizationId: "org_1",
        invoiceId: "INV-2026-0001",
      })

      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ invoiceNumber: "INV-2026-0001" }),
            ]),
          }),
        })
      )
    })

    it("returns null when invoice not found", async () => {
      mockFindFirst.mockResolvedValue(null)

      const result = await repo.findByIdForOrganization({
        organizationId: "org_1",
        invoiceId: "inv_nonexistent",
      })

      expect(result).toBeNull()
    })

    it("omits billingAccount filter when organizationId is null", async () => {
      mockFindFirst.mockResolvedValue({
        ...baseInvoice,
        lines: [baseLine],
      })

      await repo.findByIdForOrganization({
        organizationId: null,
        invoiceId: "inv_1",
      })

      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            billingAccount: expect.anything(),
          }),
        })
      )
    })
  })

  describe("updateStatusByIdForOrganization", () => {
    it("updates status to VOID for canceled invoices", async () => {
      mockUpdateMany.mockResolvedValue({ count: 1 })

      await repo.updateStatusByIdForOrganization({
        organizationId: "org_1",
        invoiceId: "inv_1",
        status: "VOID",
      })

      expect(mockUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ id: "inv_1" }),
            ]),
            billingAccount: {
              organizationId: "org_1",
            },
          }),
          data: { status: "VOID" },
        })
      )
    })

    it("looks up by invoiceNumber as well as id", async () => {
      mockUpdateMany.mockResolvedValue({ count: 1 })

      await repo.updateStatusByIdForOrganization({
        organizationId: "org_1",
        invoiceId: "INV-2026-0001",
        status: "PAID",
      })

      expect(mockUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ invoiceNumber: "INV-2026-0001" }),
            ]),
          }),
          data: { status: "PAID" },
        })
      )
    })

    it("omits billingAccount filter when organizationId is null", async () => {
      mockUpdateMany.mockResolvedValue({ count: 0 })

      await repo.updateStatusByIdForOrganization({
        organizationId: null,
        invoiceId: "inv_1",
        status: "UNCOLLECTIBLE",
      })

      expect(mockUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            billingAccount: expect.anything(),
          }),
          data: { status: "UNCOLLECTIBLE" },
        })
      )
    })
  })
})
