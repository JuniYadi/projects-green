import { beforeEach, describe, expect, it, mock } from "bun:test"

// ── mocks (before imports) ────────────────────────────────────────────────

const mockPrisma = {
  applicationStack: { findFirst: mock(), findMany: mock() },
  applicationContainerImage: {
    findMany: mock(),
    updateMany: mock(),
  },
}

const mockResolveClusterIntegration = mock()
const mockListAllKeysWithClient = mock()
const mockDeleteRegistryKeyWithClient = mock()
const mockReadManifestJsonWithClient = mock()

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))
mock.module("@/modules/deploy/cluster-integration.service", () => ({
  resolveClusterIntegration: mockResolveClusterIntegration,
}))
mock.module("@/lib/storage/registry-s3", () => ({
  createRegistryS3Client: () => ({}),
  listAllKeysWithClient: mockListAllKeysWithClient,
  deleteRegistryKeyWithClient: mockDeleteRegistryKeyWithClient,
  readManifestJsonWithClient: mockReadManifestJsonWithClient,
}))
mock.module("@/lib/logger", () => ({
  logger: { info: mock(), warn: mock(), error: mock() },
}))

const { gcRegistryImage, runRegistryGc } = await import("./registry-gc.worker")

// ── helpers ───────────────────────────────────────────────────────────────

const SLUG = "laravel-sparkling-phoenix-qns2"
const STACK_ID = "stack-abc"

const makeManifest = (layers: string[], config = "sha256:cfg111") => ({
  schemaVersion: 2,
  config: { digest: config },
  layers: layers.map((d) => ({ digest: d })),
})

// ── tests ─────────────────────────────────────────────────────────────────

describe("gcRegistryImage", () => {
  beforeEach(() => {
    mockPrisma.applicationStack.findFirst.mockClear()
    mockPrisma.applicationStack.findMany.mockClear()
    mockPrisma.applicationContainerImage.findMany.mockClear()
    mockPrisma.applicationContainerImage.updateMany.mockClear()
    mockResolveClusterIntegration.mockClear()
    mockListAllKeysWithClient.mockClear()
    mockDeleteRegistryKeyWithClient.mockClear()
    mockReadManifestJsonWithClient.mockClear()

    mockResolveClusterIntegration.mockResolvedValue({
      host: "registry-apac.pfnapp.com",
      s3Bucket: "registry-apac.pfnapp.com",
      s3Endpoint: "https://r2.cloudflarestorage.com",
      s3AccessKeyId: "mock-key",
      s3SecretAccessKey: "mock-secret",
    })
  })

  it("skips when stack not found in DB", async () => {
    mockPrisma.applicationStack.findFirst.mockResolvedValue(null)

    const result = await gcRegistryImage(SLUG)

    expect(result.skipped).toBe(true)
    expect(result.skipReason).toContain("Stack not found in DB")
    expect(mockDeleteRegistryKeyWithClient).not.toHaveBeenCalled()
  })

  it("skips when cluster integration fails to resolve", async () => {
    mockPrisma.applicationStack.findFirst.mockResolvedValue({ id: STACK_ID })
    mockResolveClusterIntegration.mockRejectedValue(
      new Error("Integration missing")
    )

    const result = await gcRegistryImage(SLUG)

    expect(result.skipped).toBe(true)
    expect(result.skipReason).toContain(
      "Failed to resolve cluster registry integration"
    )
  })

  it("skips when no manifests found in S3", async () => {
    mockPrisma.applicationStack.findFirst.mockResolvedValue({ id: STACK_ID })
    mockListAllKeysWithClient.mockResolvedValue([])

    const result = await gcRegistryImage(SLUG)

    expect(result.skipped).toBe(true)
    expect(result.skipReason).toContain("No manifests found")
    expect(mockDeleteRegistryKeyWithClient).not.toHaveBeenCalled()
  })

  it("deletes expired tag manifest and its orphaned blobs", async () => {
    mockPrisma.applicationStack.findFirst.mockResolvedValue({ id: STACK_ID })
    mockListAllKeysWithClient.mockImplementation(
      async (_client: any, prefix: string) => {
        if (prefix.includes("/manifests/")) {
          return [
            `v2/${SLUG}/manifests/6`,
            `v2/${SLUG}/manifests/7`,
            `v2/${SLUG}/manifests/sha256:digest-of-6`,
            `v2/${SLUG}/manifests/sha256:digest-of-7`,
          ]
        }
        if (prefix.includes("/blobs/")) {
          return [
            `v2/${SLUG}/blobs/sha256:layer-only-in-6`,
            `v2/${SLUG}/blobs/sha256:layer-in-7`,
            `v2/${SLUG}/blobs/sha256:cfg111`,
          ]
        }
        return []
      }
    )

    mockPrisma.applicationContainerImage.findMany.mockResolvedValue([
      { imageTag: "7", status: "ACTIVE" },
      { imageTag: "6", status: "EXPIRED" },
    ])

    mockReadManifestJsonWithClient.mockImplementation(
      async (_client: any, key: string) => {
        if (key.endsWith("/7")) {
          return makeManifest(["sha256:layer-in-7"], "sha256:cfg111")
        }
        return null
      }
    )

    mockDeleteRegistryKeyWithClient.mockResolvedValue(true)

    const result = await gcRegistryImage(SLUG)

    expect(result.skipped).toBe(false)
    expect(mockDeleteRegistryKeyWithClient).toHaveBeenCalledWith(
      expect.anything(),
      `v2/${SLUG}/blobs/sha256:layer-only-in-6`
    )
    expect(result.blobsDeleted).toBe(1)
    expect(mockDeleteRegistryKeyWithClient).toHaveBeenCalledWith(
      expect.anything(),
      `v2/${SLUG}/manifests/6`
    )
    expect(result.manifestsDeleted).toBeGreaterThanOrEqual(1)
  })
})

describe("runRegistryGc", () => {
  beforeEach(() => {
    mockPrisma.applicationStack.findFirst.mockClear()
    mockPrisma.applicationStack.findMany.mockClear()
    mockPrisma.applicationContainerImage.findMany.mockClear()
    mockPrisma.applicationContainerImage.updateMany.mockClear()
    mockResolveClusterIntegration.mockClear()
    mockListAllKeysWithClient.mockClear()
    mockDeleteRegistryKeyWithClient.mockClear()
    mockReadManifestJsonWithClient.mockClear()

    mockResolveClusterIntegration.mockResolvedValue({
      host: "registry-apac.pfnapp.com",
      s3Bucket: "registry-apac.pfnapp.com",
    })
  })

  it("returns early when no expired images in DB", async () => {
    mockPrisma.applicationContainerImage.findMany.mockResolvedValue([])
    mockPrisma.applicationStack.findMany.mockResolvedValue([])

    const result = await runRegistryGc()

    expect(result.processedImages).toBe(0)
    expect(result.totalBlobsDeleted).toBe(0)
  })

  it("marks EXPIRED images as PURGED after successful GC", async () => {
    mockPrisma.applicationContainerImage.findMany
      .mockResolvedValueOnce([{ stackId: STACK_ID }])
      .mockResolvedValueOnce([
        { imageTag: "6", status: "EXPIRED" },
        { imageTag: "7", status: "ACTIVE" },
      ])

    mockPrisma.applicationStack.findMany.mockResolvedValue([{ slug: SLUG }])
    mockPrisma.applicationStack.findFirst.mockResolvedValue({ id: STACK_ID })
    mockPrisma.applicationContainerImage.updateMany.mockResolvedValue({
      count: 1,
    })

    mockListAllKeysWithClient.mockImplementation(
      async (_c: any, prefix: string) => {
        if (prefix.includes("/manifests/"))
          return [`v2/${SLUG}/manifests/6`, `v2/${SLUG}/manifests/7`]
        if (prefix.includes("/blobs/"))
          return [`v2/${SLUG}/blobs/sha256:old-blob`]
        return []
      }
    )

    mockReadManifestJsonWithClient.mockImplementation(
      async (_c: any, key: string) => {
        if (key.endsWith("/7"))
          return makeManifest(["sha256:new-blob"], "sha256:cfg")
        return null
      }
    )

    mockDeleteRegistryKeyWithClient.mockResolvedValue(true)

    const result = await runRegistryGc()

    expect(result.processedImages).toBe(1)
    expect(
      mockPrisma.applicationContainerImage.updateMany
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "EXPIRED", purgedAt: null }),
        data: expect.objectContaining({ status: "PURGED" }),
      })
    )
  })
})
