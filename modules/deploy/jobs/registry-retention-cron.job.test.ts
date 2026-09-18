import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockPrisma = {
  applicationContainerImage: {
    findMany: mock(),
    updateMany: mock(),
  },
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

const { runRegistryRetentionCleanup } = await import(
  "./registry-retention-cron.job"
)

describe("registry-retention-cron.job", () => {
  beforeEach(() => {
    mockPrisma.applicationContainerImage.findMany.mockClear()
    mockPrisma.applicationContainerImage.updateMany.mockClear()
  })

  it("purges expired images and records purgedAt timestamp", async () => {
    mockPrisma.applicationContainerImage.findMany.mockResolvedValue([
      { id: "img-expired-1", stackId: "stack-1", imageTag: "0", digest: "sha256:000" },
      { id: "img-expired-2", stackId: "stack-2", imageTag: "1", digest: "sha256:111" },
    ])
    mockPrisma.applicationContainerImage.updateMany.mockResolvedValue({ count: 2 })

    const result = await runRegistryRetentionCleanup()

    expect(result.purgedCount).toBe(2)
    expect(result.purgedImageIds).toEqual(["img-expired-1", "img-expired-2"])
    expect(mockPrisma.applicationContainerImage.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["img-expired-1", "img-expired-2"] } },
      data: {
        status: "PURGED",
        purgedAt: expect.any(Date),
      },
    })
  })

  it("returns 0 purged count when no expired images exist", async () => {
    mockPrisma.applicationContainerImage.findMany.mockResolvedValue([])

    const result = await runRegistryRetentionCleanup()

    expect(result.purgedCount).toBe(0)
    expect(result.purgedImageIds).toHaveLength(0)
    expect(mockPrisma.applicationContainerImage.updateMany).not.toHaveBeenCalled()
  })
})
