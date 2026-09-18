import type { VulnerabilitySeverity } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  getPresignedPutUrl,
  getPresignedGetUrl,
} from "@/lib/storage/s3-storage"
import { encryptTenantStoragePath } from "@/lib/crypto"
import { enqueueSecurityScanIngest } from "@/lib/queue/security-scan-ingest"
import {
  toContainerImageDTO,
  toSecurityScanSummaryDTO,
  toSecurityScanFindingDTO,
  type ContainerImageDTO,
  type SecurityScanSummaryDTO,
  type SecurityScanFindingDTO,
} from "./security-artifacts.dto"

export type CreateScanPresignInput = {
  stackId: string
  imageTag: string
  organizationId: string
}

export type ConfirmSecurityScanInput = {
  stackId: string
  imageTag: string
  storageKey: string
  scannerEngine?: string
  scannerVersion?: string
  criticalCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  unfixedCount?: number
  organizationId: string
}

export type SecurityOverviewDTO = {
  activeImage: ContainerImageDTO | null
  latestScan: SecurityScanSummaryDTO | null
}

export type GetScanFindingsInput = {
  scanId: string
  organizationId: string
  severity?: VulnerabilitySeverity
  class?: string
  search?: string
  limit?: number
  offset?: number
}

export async function createScanPresignedUploadUrl(
  input: CreateScanPresignInput
): Promise<{ uploadUrl: string; storageKey: string }> {
  const flatHex = encryptTenantStoragePath(input.organizationId)
  const storageKey = `${flatHex}/stacks/${input.stackId}/scans/${input.imageTag}-trivy-report.json`

  const uploadUrl = await getPresignedPutUrl({
    storageKey,
    mimeType: "application/json",
    expiresInSeconds: 900,
  })

  return { uploadUrl, storageKey }
}

export async function confirmSecurityScan(
  input: ConfirmSecurityScanInput
): Promise<{ scanId: string; queued: boolean }> {
  // 1. Resolve or create ApplicationContainerImage
  let image = await prisma.applicationContainerImage.findUnique({
    where: {
      stackId_imageTag: {
        stackId: input.stackId,
        imageTag: input.imageTag,
      },
    },
  })

  if (!image) {
    image = await prisma.applicationContainerImage.create({
      data: {
        organizationId: input.organizationId,
        stackId: input.stackId,
        imageTag: input.imageTag,
        buildNumber: parseInt(input.imageTag, 10) || 1,
        status: "READY",
      },
    })
  }

  // 2. Determine scan status
  const scanStatus =
    input.criticalCount > 0
      ? "FAILED"
      : input.highCount > 0
        ? "WARNING"
        : "PASSED"

  // 3. Upsert scan summary record
  const scan = await prisma.applicationSecurityScan.upsert({
    where: {
      imageId: image.id,
    },
    update: {
      status: scanStatus,
      criticalCount: input.criticalCount,
      highCount: input.highCount,
      mediumCount: input.mediumCount,
      lowCount: input.lowCount,
      unfixedCount: input.unfixedCount ?? 0,
      storageKey: input.storageKey,
      scannerEngine: input.scannerEngine || "trivy",
      scannerVersion: input.scannerVersion || "0.73.0",
      scannedAt: new Date(),
    },
    create: {
      organizationId: input.organizationId,
      stackId: input.stackId,
      imageId: image.id,
      imageTag: input.imageTag,
      status: scanStatus,
      criticalCount: input.criticalCount,
      highCount: input.highCount,
      mediumCount: input.mediumCount,
      lowCount: input.lowCount,
      unfixedCount: input.unfixedCount ?? 0,
      storageKey: input.storageKey,
      scannerEngine: input.scannerEngine || "trivy",
      scannerVersion: input.scannerVersion || "0.73.0",
      scannedAt: new Date(),
    },
  })

  // 4. Enqueue background parsing job to worker
  const queued = await enqueueSecurityScanIngest(scan.id, input.storageKey)

  return { scanId: scan.id, queued }
}

export async function getSecurityOverview(
  stackId: string,
  organizationId: string
): Promise<SecurityOverviewDTO> {
  const activeImage = await prisma.applicationContainerImage.findFirst({
    where: {
      stackId,
      organizationId,
      status: "ACTIVE",
    },
    include: {
      securityScan: true,
    },
  })

  let latestScan = activeImage?.securityScan
    ? toSecurityScanSummaryDTO(activeImage.securityScan)
    : null

  if (!latestScan) {
    const fallbackScan = await prisma.applicationSecurityScan.findFirst({
      where: {
        stackId,
        organizationId,
      },
      orderBy: { scannedAt: "desc" },
    })
    if (fallbackScan) {
      latestScan = toSecurityScanSummaryDTO(fallbackScan)
    }
  }

  return {
    activeImage: activeImage ? toContainerImageDTO(activeImage) : null,
    latestScan,
  }
}

export async function getScanFindings(
  input: GetScanFindingsInput
): Promise<{
  findings: SecurityScanFindingDTO[]
  total: number
  limit: number
  offset: number
}> {
  const limit = Math.min(input.limit || 50, 100)
  const offset = input.offset || 0

  const whereClause = {
    scanId: input.scanId,
    scan: {
      organizationId: input.organizationId,
    },
    ...(input.severity ? { severity: input.severity } : {}),
    ...(input.class ? { class: input.class } : {}),
    ...(input.search
      ? {
          OR: [
            { packageName: { contains: input.search, mode: "insensitive" as const } },
            { cveId: { contains: input.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  }

  const [findings, total] = await Promise.all([
    prisma.securityScanFinding.findMany({
      where: whereClause,
      include: {
        vulnerability: true,
      },
      orderBy: [{ severity: "asc" }, { packageName: "asc" }],
      take: limit,
      skip: offset,
    }),
    prisma.securityScanFinding.count({
      where: whereClause,
    }),
  ])

  return {
    findings: findings.map(toSecurityScanFindingDTO),
    total,
    limit,
    offset,
  }
}

export async function getScanReportDownloadUrl(
  scanId: string,
  organizationId: string
): Promise<{ downloadUrl: string; storageKey: string }> {
  const scan = await prisma.applicationSecurityScan.findFirst({
    where: {
      id: scanId,
      organizationId,
    },
  })

  if (!scan) {
    throw new Error("Security scan not found.")
  }

  const downloadUrl = await getPresignedGetUrl({
    storageKey: scan.storageKey,
    expiresInSeconds: 900,
  })

  return { downloadUrl, storageKey: scan.storageKey }
}
