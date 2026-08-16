import { describe, it, expect, mock, beforeEach } from "bun:test"
import type { PrismaClient } from "@prisma/client"

const mockFindMany = mock()
const mockUpdate = mock()
const mockOnSuspend = mock()
const mockOnTerminate = mock()

const mockPrismaClient = {
  serviceSubscription: { findMany: mockFindMany, update: mockUpdate },
}

import { RenewalCoordinatorService } from "./renewal-coordinator.service"

const now = new Date("2026-09-05T00:00:00.000Z")

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub-1",
    organizationId: "org-1",
    status: "ACTIVE",
    currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z"),
    cancelAtPeriodEnd: false,
    package: { code: "VPN" },
    ...overrides,
  }
}

describe("RenewalCoordinatorService.runLadderTransitions", () => {
  let service: RenewalCoordinatorService

  beforeEach(() => {
    mock.clearAllMocks()
    mockUpdate.mockResolvedValue({ id: "sub-1" })
    mockOnSuspend.mockResolvedValue(undefined)
    mockOnTerminate.mockResolvedValue(undefined)

    service = new RenewalCoordinatorService(
      mockPrismaClient as unknown as PrismaClient,
      { VPN: { onSuspend: mockOnSuspend, onTerminate: mockOnTerminate } }
    )
  })

  it("suspends a subscription one day past due and calls the product callback", async () => {
    mockFindMany.mockResolvedValue([subscription()])

    const result = await service.runLadderTransitions(now)

    expect(result.suspended).toBe(1)
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: { status: "SUSPENDED" },
    })
    expect(mockOnSuspend).toHaveBeenCalledWith("sub-1")
  })

  it("terminates a subscription seven days past due", async () => {
    mockFindMany.mockResolvedValue([
      subscription({
        status: "SUSPENDED",
        currentPeriodEnd: new Date("2026-08-29T00:00:00.000Z"),
      }),
    ])

    const result = await service.runLadderTransitions(now)

    expect(result.terminated).toBe(1)
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: { status: "CANCELLED" },
    })
    expect(mockOnTerminate).toHaveBeenCalledWith("sub-1")
  })

  it("leaves a subscription that is not yet past due untouched", async () => {
    mockFindMany.mockResolvedValue([
      subscription({
        currentPeriodEnd: new Date("2026-09-10T00:00:00.000Z"),
      }),
    ])

    const result = await service.runLadderTransitions(now)

    expect(result).toEqual({ suspended: 0, terminated: 0, failed: 0 })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("does not re-suspend a subscription already suspended at the same rung", async () => {
    mockFindMany.mockResolvedValue([subscription({ status: "SUSPENDED" })])

    const result = await service.runLadderTransitions(now)

    expect(result.suspended).toBe(0)
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockOnSuspend).not.toHaveBeenCalled()
  })

  it("counts a failing product callback without blocking other subscriptions", async () => {
    mockOnSuspend.mockRejectedValue(new Error("ssh unreachable"))
    mockFindMany.mockResolvedValue([
      subscription({ id: "sub-1" }),
      subscription({ id: "sub-2" }),
    ])
    mockUpdate.mockResolvedValue({ id: "sub-x" })

    const result = await service.runLadderTransitions(now)

    expect(result.failed).toBe(2)
    expect(result.suspended).toBe(0)
  })

  it("skips products with no registered callbacks", async () => {
    mockFindMany.mockResolvedValue([
      subscription({ package: { code: "WHATSAPP" } }),
    ])

    const result = await service.runLadderTransitions(now)

    expect(result).toEqual({ suspended: 0, terminated: 0, failed: 0 })
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
