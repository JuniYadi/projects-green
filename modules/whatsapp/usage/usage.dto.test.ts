import { describe, expect, it } from "bun:test"
import { Prisma } from "@prisma/client"
import { toDailyCountDTO, toMonthlyCountDTO, toCostDTO } from "./usage.dto"

describe("usage DTO mappers", () => {
  it("maps daily count row to DTO", () => {
    const date = new Date("2026-09-01T00:00:00.000Z")
    const now = new Date("2026-09-01T12:00:00.000Z")
    const row = {
      id: "dc_1",
      organizationId: "org_1",
      whatsappDeviceId: "dev_1",
      date,
      sessionCount: 10,
      messageInboxCount: 20,
      messageOutboxCount: 30,
      messageFailedCount: 2,
      createdAt: now,
      updatedAt: now,
    }
    expect(toDailyCountDTO(row)).toEqual({
      id: "dc_1",
      organizationId: "org_1",
      date,
      sessionCount: 10,
      messageInboxCount: 20,
      messageOutboxCount: 30,
      messageFailedCount: 2,
      whatsappDeviceId: "dev_1",
    })
  })

  it("maps monthly count row to DTO", () => {
    const now = new Date("2026-09-01T12:00:00.000Z")
    const row = {
      id: "mc_1",
      organizationId: "org_1",
      whatsappDeviceId: "dev_1",
      year: 2026,
      month: 9,
      sessionCount: 100,
      messageInboxCount: 200,
      messageOutboxCount: 300,
      messageFailedCount: 5,
      createdAt: now,
      updatedAt: now,
    }
    expect(toMonthlyCountDTO(row)).toEqual({
      id: "mc_1",
      organizationId: "org_1",
      year: 2026,
      month: 9,
      sessionCount: 100,
      messageInboxCount: 200,
      messageOutboxCount: 300,
      messageFailedCount: 5,
      whatsappDeviceId: "dev_1",
    })
  })

  it("maps billing usage ledger row to cost DTO", () => {
    const now = new Date("2026-09-01T12:00:00.000Z")
    const decimalAmount = new Prisma.Decimal(50000)
    const row = {
      id: "bl_1",
      organizationId: "org_1",
      subscriptionId: "sub_1",
      period: "2026-09",
      category: "MARKETING",
      amountIdr: decimalAmount,
      metadata: { count: 10 },
      createdAt: now,
    }
    expect(toCostDTO(row)).toEqual({
      id: "bl_1",
      organizationId: "org_1",
      period: "2026-09",
      category: "MARKETING",
      amountIdr: decimalAmount,
      metadata: { count: 10 },
    })
  })
})
