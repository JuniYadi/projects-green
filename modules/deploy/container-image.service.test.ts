import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockPrisma = {
  $transaction: mock(),
  applicationContainerImage: {
    findMany: mock(),
    findFirst: mock(),
    updateMany: mock(),
    upsert: mock(),
  },
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

const {
  registerContainerImage,
  getStackContainerImages,
  validateRollbackImage,
  FREE_TIER_MAX_RETAINED_IMAGES,
} = await import("./container-image.service")

describe("container-image.service", () => {
  beforeEach(() => {
    mockPrisma.$transaction.mockClear()
    mockPrisma.applicationContainerImage.findMany.mockClear()
    mockPrisma.applicationContainerImage.findFirst.mockClear()
    mockPrisma.applicationContainerImage.updateMany.mockClear()
    mockPrisma.applicationContainerImage.upsert.mockClear()
  })

  it("registers a new container image, demotes previous active, and enforces 3-image retention", async () => {
    const txMock = {
      applicationContainerImage: {
        updateMany: mock().mockResolvedValue({ count: 1 }),
        upsert: mock().mockResolvedValue({
          id: "img-3",
          organizationId: "org-1",
          stackId: "stack-1",
          imageTag: "3",
          buildNumber: 3,
          status: "ACTIVE",
          pushedAt: new Date("2026-09-19T10:00:00Z"),
          rotatedAt: null,
          purgedAt: null,
          digest: "sha256:abc",
          sizeBytes: 150000000n,
        }),
        findMany: mock().mockResolvedValue([
          { id: "img-3", status: "ACTIVE", pushedAt: new Date("2026-09-19T10:00:00Z") },
          { id: "img-2", status: "READY", pushedAt: new Date("2026-09-19T09:00:00Z") },
          { id: "img-1", status: "READY", pushedAt: new Date("2026-09-19T08:00:00Z") },
          { id: "img-0", status: "READY", pushedAt: new Date("2026-09-19T07:00:00Z") },
        ]),
      },
    }

    mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof txMock) => Promise<unknown>) => {
      return cb(txMock)
    })

    const result = await registerContainerImage({
      organizationId: "org-1",
      stackId: "stack-1",
      imageTag: "3",
      buildNumber: 3,
      digest: "sha256:abc",
      sizeBytes: "150000000",
    })

    expect(result.id).toBe("img-3")
    expect(result.status).toBe("ACTIVE")

    // 1. Demoted previous active
    expect(txMock.applicationContainerImage.updateMany).toHaveBeenCalledWith({
      where: { stackId: "stack-1", status: "ACTIVE" },
      data: { status: "READY" },
    })

    // 2. Upserted image 3
    expect(txMock.applicationContainerImage.upsert).toHaveBeenCalled()

    // 3. Rotated image past retention limit (img-0)
    expect(txMock.applicationContainerImage.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["img-0"] } },
      data: {
        status: "EXPIRED",
        rotatedAt: expect.any(Date),
      },
    })
  })

  it("validates rollback eligibility correctly based on image lifecycle status", async () => {
    // 1. Ready image is allowed
    mockPrisma.applicationContainerImage.findFirst.mockResolvedValueOnce({
      id: "img-1",
      stackId: "stack-1",
      organizationId: "org-1",
      status: "READY",
    })

    const readyCheck = await validateRollbackImage("stack-1", "img-1", "org-1")
    expect(readyCheck.allowed).toBe(true)

    // 2. Active image is rejected
    mockPrisma.applicationContainerImage.findFirst.mockResolvedValueOnce({
      id: "img-2",
      stackId: "stack-1",
      organizationId: "org-1",
      status: "ACTIVE",
    })

    const activeCheck = await validateRollbackImage("stack-1", "img-2", "org-1")
    expect(activeCheck.allowed).toBe(false)
    expect(activeCheck.reason).toContain("already the active")

    // 3. Expired image is rejected with re-build guide
    mockPrisma.applicationContainerImage.findFirst.mockResolvedValueOnce({
      id: "img-0",
      stackId: "stack-1",
      organizationId: "org-1",
      status: "EXPIRED",
    })

    const expiredCheck = await validateRollbackImage("stack-1", "img-0", "org-1")
    expect(expiredCheck.allowed).toBe(false)
    expect(expiredCheck.reason).toContain("auto-rotated to save space")

    // 4. Missing image is rejected
    mockPrisma.applicationContainerImage.findFirst.mockResolvedValueOnce(null)
    const missingCheck = await validateRollbackImage("stack-1", "img-missing", "org-1")
    expect(missingCheck.allowed).toBe(false)
    expect(missingCheck.reason).toContain("not found")
  })

  it("retrieves stack container images and serializes DTOs", async () => {
    mockPrisma.applicationContainerImage.findMany.mockResolvedValue([
      {
        id: "img-1",
        stackId: "stack-1",
        organizationId: "org-1",
        deploymentId: "dep-1",
        buildNumber: 1,
        imageTag: "1",
        digest: "sha256:111",
        sizeBytes: 100000000n,
        status: "READY",
        pushedAt: new Date("2026-09-19T08:00:00Z"),
        rotatedAt: null,
        purgedAt: null,
        securityScan: {
          id: "scan-1",
          imageId: "img-1",
          imageTag: "1",
          status: "PASSED",
          criticalCount: 0,
          highCount: 0,
          mediumCount: 1,
          lowCount: 3,
          unfixedCount: 0,
          scannerEngine: "trivy",
          scannerVersion: "0.73.0",
          scannedAt: new Date("2026-09-19T08:05:00Z"),
        },
      },
    ])

    const images = await getStackContainerImages("stack-1", "org-1")
    expect(images).toHaveLength(1)
    expect(images[0].sizeBytes).toBe("100000000")
    expect(images[0].securityScan?.status).toBe("PASSED")
    expect(images[0].securityScan?.lowCount).toBe(3)
  })
})
