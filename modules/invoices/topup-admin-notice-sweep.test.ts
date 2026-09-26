import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

const mockConsoleError = mock((..._args: unknown[]) => {})
console.error = mockConsoleError

const attemptsById = new Map<string, number>()

const mockEmailLogFindMany = mock(
  async (_args?: unknown): Promise<unknown[]> => []
)
const mockEmailLogUpdateMany = mock(
  async (args: {
    where: { id: string; attempts: number }
    data: Record<string, unknown>
  }) => {
    const current = attemptsById.get(args.where.id) ?? 0
    if (current !== args.where.attempts) return { count: 0 }
    const attemptsPatch = args.data.attempts as
      number | { increment: number } | undefined
    const next =
      typeof attemptsPatch === "number"
        ? attemptsPatch
        : current + (attemptsPatch?.increment ?? 0)
    attemptsById.set(args.where.id, next)
    return { count: 1 }
  }
)

mock.module("@/lib/prisma", () => ({
  prisma: {
    emailLog: {
      findMany: mockEmailLogFindMany,
      updateMany: mockEmailLogUpdateMany,
    },
  },
}))

const mockSendEmail = mock(
  async (_data?: unknown, _opts?: { jobId?: string }) => null
)
mock.module("@/lib/queue/email", () => ({
  sendEmail: mockSendEmail,
}))

const NOW = new Date("2026-09-27T12:00:00.000Z")

function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  const id = (overrides.id as string) ?? "log-1"
  const attempts = (overrides.attempts as number) ?? 0
  attemptsById.set(id, attempts)
  return {
    id,
    eventKey: `topup-admin:${overrides.relatedEntityId ?? "inv-1"}`,
    recipientEmail: "admin@org.com",
    subject: "Top-up received - Acme",
    bodyHtml: "<p>raw html, no secrets</p>",
    status: "QUEUED",
    attempts,
    relatedEntityId: "inv-1",
    createdAt: new Date("2026-09-27T00:00:00.000Z"),
    updatedAt: new Date("2026-09-27T00:00:00.000Z"),
    ...overrides,
  }
}

describe("sweepStrandedTopupAdminNotices", () => {
  let sweepStrandedTopupAdminNotices: typeof import("./topup-admin-notice-sweep").sweepStrandedTopupAdminNotices

  beforeEach(async () => {
    mockConsoleError.mockClear()
    mockEmailLogFindMany.mockClear()
    mockEmailLogUpdateMany.mockClear()
    mockSendEmail.mockClear()
    mockSendEmail.mockImplementation(async () => null)
    attemptsById.clear()

    const sweepModule = await import("./topup-admin-notice-sweep")
    sweepStrandedTopupAdminNotices = sweepModule.sweepStrandedTopupAdminNotices
  })

  afterEach(() => {
    mockEmailLogFindMany.mockReset()
  })

  it("increments attempts before enqueueing a stranded QUEUED row, using a _r1 jobId", async () => {
    const row = makeRow({ id: "log-1", relatedEntityId: "inv-1", attempts: 0 })
    mockEmailLogFindMany
      .mockImplementationOnce(async () => [row])
      .mockImplementationOnce(async () => [])

    const result = await sweepStrandedTopupAdminNotices(NOW)

    expect(mockEmailLogUpdateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "log-1",
        attempts: 0,
        updatedAt: { lt: new Date(NOW.getTime() - 10 * 60 * 1000) },
      }),
      data: { status: "QUEUED", attempts: { increment: 1 } },
    })
    expect(mockSendEmail).toHaveBeenCalledWith(
      {
        to: "admin@org.com",
        subject: "Top-up received - Acme",
        html: "<p>raw html, no secrets</p>",
        emailLogId: "log-1",
        noticeAttempt: 1,
      },
      { jobId: "topup-admin_inv-1_r1" }
    )

    const updateOrder = mockEmailLogUpdateMany.mock.invocationCallOrder[0]
    const sendOrder = mockSendEmail.mock.invocationCallOrder[0]
    expect(updateOrder).toBeLessThan(sendOrder)

    expect(result.found).toBe(1)
    expect(result.reenqueued).toBe(1)
    expect(result.failed).toBe(0)
  })

  it("re-enqueues a FAILED row with a jobId suffix based on the incremented attempts", async () => {
    const row = makeRow({
      id: "log-2",
      relatedEntityId: "inv-2",
      status: "FAILED",
      attempts: 2,
    })
    mockEmailLogFindMany
      .mockImplementationOnce(async () => [row])
      .mockImplementationOnce(async () => [])

    await sweepStrandedTopupAdminNotices(NOW)

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ emailLogId: "log-2" }),
      { jobId: "topup-admin_inv-2_r3" }
    )
  })

  it("queries with a where clause that excludes SENT, too-recent, and at-cap rows", async () => {
    mockEmailLogFindMany
      .mockImplementationOnce(async () => [])
      .mockImplementationOnce(async () => [])

    await sweepStrandedTopupAdminNotices(NOW)

    const staleBefore = new Date(NOW.getTime() - 10 * 60 * 1000)
    const createdAfter = new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000)

    expect(mockEmailLogFindMany).toHaveBeenNthCalledWith(1, {
      where: {
        eventKey: { startsWith: "topup-admin:" },
        status: { in: ["QUEUED", "FAILED", "PROCESSING"] },
        updatedAt: { lt: staleBefore },
        createdAt: { gt: createdAfter },
        attempts: { lt: 12 },
      },
      orderBy: { createdAt: "asc" },
      take: 50,
    })

    // SENT is never in the status filter, so a SENT row is excluded by
    // construction; too-recent (updatedAt >= staleBefore) and at-cap
    // (attempts >= 12) rows are excluded by the same where clause.
    expect(
      (
        mockEmailLogFindMany.mock.calls[0]![0] as {
          where: { status: { in: string[] } }
        }
      ).where.status.in
    ).not.toContain("SENT")
  })

  it("does not let one row's enqueue failure stop the rest of the batch", async () => {
    const rowA = makeRow({ id: "log-a", relatedEntityId: "inv-a", attempts: 0 })
    const rowB = makeRow({ id: "log-b", relatedEntityId: "inv-b", attempts: 0 })
    mockEmailLogFindMany
      .mockImplementationOnce(async () => [rowA, rowB])
      .mockImplementationOnce(async () => [])

    mockSendEmail.mockImplementationOnce(async () => {
      throw new Error("queue unavailable")
    })

    const result = await sweepStrandedTopupAdminNotices(NOW)

    expect(mockSendEmail).toHaveBeenCalledTimes(2)
    expect(mockSendEmail).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ emailLogId: "log-b" }),
      { jobId: "topup-admin_inv-b_r1" }
    )
    expect(result.reenqueued).toBe(1)
    expect(result.failed).toBe(1)
  })

  it("enqueues only once when two sweeps read the same stale row", async () => {
    const row = makeRow()
    mockEmailLogFindMany.mockImplementation(async () => [row])

    const [first, second] = await Promise.all([
      sweepStrandedTopupAdminNotices(NOW),
      sweepStrandedTopupAdminNotices(NOW),
    ])

    expect(first.reenqueued + second.reenqueued).toBe(1)
    expect(mockSendEmail).toHaveBeenCalledTimes(1)
  })

  it("does not enqueue when a worker changed the row after the sweep read it", async () => {
    const row = makeRow()
    mockEmailLogFindMany
      .mockImplementationOnce(async () => {
        attemptsById.set(row.id, 1)
        return [row]
      })
      .mockImplementationOnce(async () => [])

    const result = await sweepStrandedTopupAdminNotices(NOW)

    expect(result.reenqueued).toBe(0)
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it("logs abandonment once per row and bumps attempts past the cap", async () => {
    const abandoned = makeRow({
      id: "log-cap",
      relatedEntityId: "inv-cap",
      attempts: 12,
    })
    mockEmailLogFindMany
      .mockImplementationOnce(async () => [])
      .mockImplementationOnce(async () => [abandoned])

    const result = await sweepStrandedTopupAdminNotices(NOW)

    expect(mockConsoleError).toHaveBeenCalledTimes(1)
    expect(mockConsoleError.mock.calls[0]![0]).toMatchObject({
      event: "topup_admin_notice.abandoned",
      emailLogId: "log-cap",
    })
    expect(mockEmailLogUpdateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: "log-cap", attempts: 12 }),
      data: { attempts: 1000 },
    })
    expect(result.abandoned).toBe(1)
  })

  it("queries abandonment excluding the marker, matching cap-or-age, and requiring staleness", async () => {
    mockEmailLogFindMany
      .mockImplementationOnce(async () => [])
      .mockImplementationOnce(async () => [])

    await sweepStrandedTopupAdminNotices(NOW)

    const staleBefore = new Date(NOW.getTime() - 10 * 60 * 1000)
    const createdAfter = new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000)

    expect(mockEmailLogFindMany).toHaveBeenNthCalledWith(2, {
      where: {
        eventKey: { startsWith: "topup-admin:" },
        status: { in: ["QUEUED", "FAILED", "PROCESSING"] },
        attempts: { lt: 1000 },
        updatedAt: { lt: staleBefore },
        OR: [{ attempts: { gte: 12 } }, { createdAt: { lte: createdAfter } }],
      },
      orderBy: { createdAt: "asc" },
      take: 50,
    })
  })
})
