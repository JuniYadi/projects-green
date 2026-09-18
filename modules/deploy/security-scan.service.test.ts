import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockPrisma = {
  applicationContainerImage: {
    findUnique: mock(),
    findFirst: mock(),
    create: mock(),
  },
  applicationSecurityScan: {
    upsert: mock(),
    findFirst: mock(),
  },
  securityScanFinding: {
    findMany: mock(),
    count: mock(),
  },
}

const mockS3 = {
  getPresignedPutUrl: mock().mockResolvedValue("https://s3.example.com/upload-report"),
  getPresignedGetUrl: mock().mockResolvedValue("https://s3.example.com/download-report"),
  getS3Client: mock().mockReturnValue({
    file: mock().mockReturnValue({
      text: mock().mockResolvedValue("{}"),
    }),
  }),
}

const mockQueue = {
  enqueueSecurityScanIngest: mock().mockResolvedValue(true),
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))
mock.module("@/lib/storage/s3-storage", () => mockS3)
mock.module("@/lib/queue/security-scan-ingest", () => mockQueue)

const {
  createScanPresignedUploadUrl,
  confirmSecurityScan,
  getSecurityOverview,
  getScanFindings,
  getScanReportDownloadUrl,
} = await import("./security-scan.service")

describe("security-scan.service", () => {
  beforeEach(() => {
    mockPrisma.applicationContainerImage.findUnique.mockClear()
    mockPrisma.applicationContainerImage.findFirst.mockClear()
    mockPrisma.applicationContainerImage.create.mockClear()
    mockPrisma.applicationSecurityScan.upsert.mockClear()
    mockPrisma.applicationSecurityScan.findFirst.mockClear()
    mockPrisma.securityScanFinding.findMany.mockClear()
    mockPrisma.securityScanFinding.count.mockClear()
    mockS3.getPresignedPutUrl.mockClear()
    mockS3.getPresignedGetUrl.mockClear()
    mockQueue.enqueueSecurityScanIngest.mockClear()
  })

  it("generates presigned PUT upload URL with tenant prefix", async () => {
    const result = await createScanPresignedUploadUrl({
      stackId: "stack-1",
      imageTag: "2",
      organizationId: "org-1",
    })

    expect(result.uploadUrl).toBe("https://s3.example.com/upload-report")
    expect(result.storageKey).toContain("stacks/stack-1/scans/2-trivy-report.json")
    expect(mockS3.getPresignedPutUrl).toHaveBeenCalled()
  })

  it("confirms scan completion, determines status, and enqueues worker", async () => {
    mockPrisma.applicationContainerImage.findUnique.mockResolvedValue({
      id: "img-2",
      stackId: "stack-1",
      imageTag: "2",
    })

    mockPrisma.applicationSecurityScan.upsert.mockResolvedValue({
      id: "scan-2",
      imageId: "img-2",
      status: "WARNING",
      criticalCount: 0,
      highCount: 2,
    })

    const result = await confirmSecurityScan({
      stackId: "stack-1",
      imageTag: "2",
      storageKey: "storage/key.json",
      criticalCount: 0,
      highCount: 2,
      mediumCount: 4,
      lowCount: 1,
      organizationId: "org-1",
    })

    expect(result.scanId).toBe("scan-2")
    expect(result.queued).toBe(true)
    expect(mockPrisma.applicationSecurityScan.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: "WARNING" }),
      })
    )
    expect(mockQueue.enqueueSecurityScanIngest).toHaveBeenCalledWith(
      "scan-2",
      "storage/key.json"
    )
  })

  it("retrieves security overview for stack", async () => {
    mockPrisma.applicationContainerImage.findFirst.mockResolvedValue({
      id: "img-active",
      stackId: "stack-1",
      organizationId: "org-1",
      buildNumber: 2,
      imageTag: "2",
      digest: "sha256:4f866c",
      sizeBytes: 142000000n,
      status: "ACTIVE",
      pushedAt: new Date("2026-09-19T10:00:00Z"),
      rotatedAt: null,
      purgedAt: null,
      securityScan: {
        id: "scan-2",
        imageId: "img-active",
        imageTag: "2",
        status: "WARNING",
        criticalCount: 0,
        highCount: 2,
        mediumCount: 5,
        lowCount: 12,
        unfixedCount: 2,
        scannerEngine: "trivy",
        scannerVersion: "0.73.0",
        scannedAt: new Date("2026-09-19T10:02:00Z"),
      },
    })

    const overview = await getSecurityOverview("stack-1", "org-1")
    expect(overview.activeImage?.imageTag).toBe("2")
    expect(overview.latestScan?.status).toBe("WARNING")
    expect(overview.latestScan?.highCount).toBe(2)
  })

  it("retrieves scan findings with pagination", async () => {
    mockPrisma.securityScanFinding.findMany.mockResolvedValue([
      {
        id: "finding-1",
        scanId: "scan-2",
        cveId: "CVE-2026-1542",
        severity: "HIGH",
        packageName: "guzzlehttp/psr7",
        installedVersion: "7.14.0",
        fixedVersion: "7.15.1",
        sourceTarget: "composer.lock",
        class: "lang-pkgs",
        introducedBy: "laravel/framework",
        createdAt: new Date(),
        vulnerability: {
          cveId: "CVE-2026-1542",
          title: "Header injection in guzzlehttp/psr7",
          description: null,
          severity: "HIGH",
          cvssScore: 7.5,
          primaryUrl: "https://example.com/cve-1542",
        },
      },
    ])
    mockPrisma.securityScanFinding.count.mockResolvedValue(1)

    const result = await getScanFindings({
      scanId: "scan-2",
      organizationId: "org-1",
      limit: 10,
    })

    expect(result.findings).toHaveLength(1)
    expect(result.total).toBe(1)
    expect(result.findings[0].packageName).toBe("guzzlehttp/psr7")
    expect(result.findings[0].vulnerability?.title).toBe(
      "Header injection in guzzlehttp/psr7"
    )
  })

  it("generates presigned download URL for full report", async () => {
    mockPrisma.applicationSecurityScan.findFirst.mockResolvedValue({
      id: "scan-2",
      organizationId: "org-1",
      storageKey: "tenants/org-1/scan-2.json",
    })

    const result = await getScanReportDownloadUrl("scan-2", "org-1")
    expect(result.downloadUrl).toBe("https://s3.example.com/download-report")
    expect(result.storageKey).toBe("tenants/org-1/scan-2.json")
  })
})
