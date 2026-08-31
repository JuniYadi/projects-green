import { beforeEach, describe, expect, it, mock } from "bun:test"

import { DailyOperationsService } from "./daily-operations.service"
import type { DailyOperationsPrisma } from "./daily-operations.service"

const count = mock(async () => 0)
const findFirst = mock(async (): Promise<{ createdAt: Date } | null> => null)

const prismaMock: DailyOperationsPrisma = {
  paymentConfirmation: { count, findFirst },
  applicationDeployment: { count, findFirst },
  supportTicket: { count, findFirst },
  billingInvoice: { count, findFirst },
  billingOrder: { count, findFirst },
}

describe("DailyOperationsService", () => {
  beforeEach(() => {
    count.mockReset()
    findFirst.mockReset()
    count.mockResolvedValue(0)
    findFirst.mockResolvedValue(null)
  })

  it("returns prioritized queue metrics and clean messages", async () => {
    count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(6)

    const service = new DailyOperationsService(prismaMock)
    const result = await service.getOverview({
      now: new Date("2026-08-31T12:00:00.000Z"),
    })

    expect(result.actionRequired).toHaveLength(4)
    expect(result.actionRequired.map((item) => item.priority)).toEqual([
      "HIGH",
      "HIGH",
      "HIGH",
      "HIGH",
    ])
    expect(result.paymentsAwaitingConfirmation.count).toBe(2)
    expect(result.overdueInvoices.count).toBe(4)
    expect(result.newOrders.count).toBe(5)
    expect(result.newInvoices.count).toBe(6)
  })

  it("keeps the overview available when an individual queue query fails", async () => {
    count.mockRejectedValueOnce(new Error("payment database unavailable"))

    const service = new DailyOperationsService(prismaMock)
    const result = await service.getOverview({
      now: new Date("2026-08-31T12:00:00.000Z"),
    })

    expect(result.paymentsAwaitingConfirmation.count).toBe(0)
    expect(result.paymentsAwaitingConfirmation.available).toBe(false)
    expect(result.overdueInvoices.available).toBe(true)
  })

  it("calculates oldest age in minutes and reports clean queues", async () => {
    findFirst.mockResolvedValueOnce({
      createdAt: new Date("2026-08-31T10:30:00.000Z"),
    })

    const service = new DailyOperationsService(prismaMock)
    const result = await service.getOverview({
      now: new Date("2026-08-31T12:00:00.000Z"),
    })

    expect(result.paymentsAwaitingConfirmation.ageMinutes).toBe(90)
    expect(result.overdueInvoices.message).toBe("Antrean bersih")
  })
})
