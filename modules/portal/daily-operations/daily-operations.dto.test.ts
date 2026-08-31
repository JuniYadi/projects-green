import { describe, expect, it } from "bun:test"

import {
  toDTO,
  type DailyOperationsMetric,
  type DailyOperationsSnapshot,
} from "./daily-operations.dto"

describe("daily-operations.dto", () => {
  it("maps snapshot to DTO with ISO strings and arrays", () => {
    const now = new Date("2026-08-31T12:00:00.000Z")
    const oldest = new Date("2026-08-31T11:00:00.000Z")

    const sampleMetric: DailyOperationsMetric = {
      key: "paymentsAwaitingConfirmation",
      label: "Pembayaran menunggu konfirmasi",
      priority: "HIGH",
      count: 2,
      href: "/portal/billing/payments?status=PENDING",
      oldestAt: oldest,
      ageMinutes: 60,
      message: "2 pembayaran menunggu konfirmasi",
      available: true,
    }

    const snapshot: DailyOperationsSnapshot = {
      generatedAt: now,
      paymentsAwaitingConfirmation: sampleMetric,
      failedDeployments: {
        ...sampleMetric,
        key: "failedDeployments",
        count: 0,
        oldestAt: null,
        ageMinutes: null,
      },
      supportTickets: {
        ...sampleMetric,
        key: "supportTickets",
        count: 0,
        oldestAt: null,
        ageMinutes: null,
      },
      overdueInvoices: {
        ...sampleMetric,
        key: "overdueInvoices",
        count: 0,
        oldestAt: null,
        ageMinutes: null,
      },
      newOrders: {
        ...sampleMetric,
        key: "newOrders",
        priority: "INFO",
        count: 1,
        oldestAt: null,
        ageMinutes: null,
      },
      newInvoices: {
        ...sampleMetric,
        key: "newInvoices",
        priority: "INFO",
        count: 0,
        oldestAt: null,
        ageMinutes: null,
      },
    }

    const dto = toDTO(snapshot)

    expect(dto.generatedAt).toBe(now.toISOString())
    expect(dto.actionRequired.length).toBe(4)
    expect(dto.queueSummary.length).toBe(2)
    expect(dto.paymentsAwaitingConfirmation.oldestAt).toBe(oldest.toISOString())
    expect(dto.paymentsAwaitingConfirmation.count).toBe(2)
  })
})
