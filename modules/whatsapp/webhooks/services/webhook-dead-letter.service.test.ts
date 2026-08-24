import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockFindUnique = mock(async () => null)
const mockUpdate = mock(async () => ({}))
const mockCreate = mock(async () => ({ id: "dl-123" }))
const mockFindMany = mock(async () => [])
const mockCount = mock(async () => 0)

const mockPrisma = {
  whatsappWebhookDeadLetter: {
    findUnique: mockFindUnique,
    update: mockUpdate,
    create: mockCreate,
    findMany: mockFindMany,
    count: mockCount,
  },
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

const mockDispatch = mock(async () => true)

mock.module("../jobs/webhook-retry.job", () => ({
  WebhookRetryJob: {
    dispatch: mockDispatch,
  },
}))

const { replayDeadLetter } = await import("./webhook-dead-letter.service")

describe("webhook-dead-letter.service replayDeadLetter", () => {
  beforeEach(() => {
    mockFindUnique.mockClear()
    mockUpdate.mockClear()
    mockDispatch.mockClear()
  })

  it("replays dead letter with UUID v7 without colons", async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: "dl-456",
      deviceId: "dev-1",
      organizationId: "org-1",
      eventType: "inbound_message",
      rawPayload: { message: "hello" },
    } as any)

    await replayDeadLetter("dl-456")

    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "dl-456" } })
    expect(mockDispatch).toHaveBeenCalledTimes(1)

    const dispatchCall = (mockDispatch.mock.calls as unknown[][])[0][0] as {
      eventId: string
      eventType: string
      deviceId: string
      organizationId?: string
      payload: unknown
    }

    expect(dispatchCall.eventType).toBe("message")
    expect(dispatchCall.deviceId).toBe("dev-1")
    expect(dispatchCall.organizationId).toBe("org-1")
    expect(dispatchCall.eventId).toMatch(
      /^replay-dl-456-[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
    expect(dispatchCall.eventId).not.toContain(":")
    expect(mockUpdate).toHaveBeenCalledTimes(2)
  })

  it("throws error when dead letter not found", async () => {
    mockFindUnique.mockResolvedValueOnce(null)

    await expect(replayDeadLetter("non-existent")).rejects.toThrow(
      "Dead letter not found"
    )
    expect(mockDispatch).not.toHaveBeenCalled()
  })
})
