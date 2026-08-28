import { describe, it, expect, mock, beforeEach } from "bun:test"
import type { PrismaClient } from "@prisma/client"

const mockFulfillOrder = mock()

mock.module("./order.service", () => ({
  BillingOrderService: class {
    fulfillOrder = mockFulfillOrder
  },
}))

// Test boundary requires static import after mock.module setup
import { settleProductOrdersForInvoice } from "./payment-settlement"

describe("settleProductOrdersForInvoice", () => {
  beforeEach(() => {
    mock.clearAllMocks()
  })

  it("does nothing when billingOrder delegate is undefined", async () => {
    const mockPrisma = {} as PrismaClient
    await settleProductOrdersForInvoice("inv-1", mockPrisma)
    expect(mockFulfillOrder).not.toHaveBeenCalled()
  })

  it("does nothing when no orders match invoice", async () => {
    const mockFindMany = mock().mockResolvedValue([])
    const mockPrisma = {
      billingOrder: {
        findMany: mockFindMany,
      },
    } as unknown as PrismaClient

    await settleProductOrdersForInvoice("inv-1", mockPrisma)
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { billingInvoiceId: "inv-1" },
      select: { id: true, status: true },
    })
    expect(mockFulfillOrder).not.toHaveBeenCalled()
  })

  it("skips orders that are not PENDING, CHARGED, or FAILED", async () => {
    const mockFindMany = mock().mockResolvedValue([
      { id: "order-completed", status: "FULFILLED" },
      { id: "order-canceled", status: "CANCELED" },
    ])
    const mockPrisma = {
      billingOrder: {
        findMany: mockFindMany,
      },
    } as unknown as PrismaClient

    await settleProductOrdersForInvoice("inv-1", mockPrisma)
    expect(mockFulfillOrder).not.toHaveBeenCalled()
  })

  it("claims and fulfills PENDING order with updateMany", async () => {
    const mockFindMany = mock().mockResolvedValue([
      { id: "order-1", status: "PENDING" },
    ])
    const mockUpdateMany = mock().mockResolvedValue({ count: 1 })
    const mockPrisma = {
      billingOrder: {
        findMany: mockFindMany,
        updateMany: mockUpdateMany,
      },
    } as unknown as PrismaClient

    await settleProductOrdersForInvoice("inv-1", mockPrisma)

    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order-1", status: "PENDING" },
        data: expect.objectContaining({ status: "CHARGED" }),
      })
    )
    expect(mockFulfillOrder).toHaveBeenCalledWith("order-1")
  })

  it("skips fulfillment if updateMany fails to claim PENDING order", async () => {
    const mockFindMany = mock().mockResolvedValue([
      { id: "order-1", status: "PENDING" },
    ])
    const mockUpdateMany = mock().mockResolvedValue({ count: 0 })
    const mockPrisma = {
      billingOrder: {
        findMany: mockFindMany,
        updateMany: mockUpdateMany,
      },
    } as unknown as PrismaClient

    await settleProductOrdersForInvoice("inv-1", mockPrisma)

    expect(mockUpdateMany).toHaveBeenCalled()
    expect(mockFulfillOrder).not.toHaveBeenCalled()
  })

  it("updates and fulfills PENDING order when updateMany is not available", async () => {
    const mockFindMany = mock().mockResolvedValue([
      { id: "order-1", status: "PENDING" },
    ])
    const mockUpdate = mock().mockResolvedValue({ id: "order-1" })
    const mockPrisma = {
      billingOrder: {
        findMany: mockFindMany,
        update: mockUpdate,
      },
    } as unknown as PrismaClient

    await settleProductOrdersForInvoice("inv-1", mockPrisma)

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order-1" },
        data: expect.objectContaining({ status: "CHARGED" }),
      })
    )
    expect(mockFulfillOrder).toHaveBeenCalledWith("order-1")
  })

  it("fulfills already CHARGED or FAILED orders directly without claiming status", async () => {
    const mockFindMany = mock().mockResolvedValue([
      { id: "order-charged", status: "CHARGED" },
      { id: "order-failed", status: "FAILED" },
    ])
    const mockUpdateMany = mock()
    const mockPrisma = {
      billingOrder: {
        findMany: mockFindMany,
        updateMany: mockUpdateMany,
      },
    } as unknown as PrismaClient

    await settleProductOrdersForInvoice("inv-1", mockPrisma)

    expect(mockUpdateMany).not.toHaveBeenCalled()
    expect(mockFulfillOrder).toHaveBeenCalledWith("order-charged")
    expect(mockFulfillOrder).toHaveBeenCalledWith("order-failed")
  })
})
