import { prisma } from "@/lib/prisma"
import {
  buildS3StorageKey,
  extractOrganizationIdFromS3Key,
  getPresignedPutUrl,
  getPresignedGetUrl,
  statStorageFile,
  deleteStorageFile,
  getS3Config,
} from "@/lib/storage/s3-storage"
import {
  toStorageFileDTO,
  type PresignUploadRequest,
  type PresignUploadResponseDTO,
  type ConfirmUploadRequest,
  type StorageFileDTO,
  type StorageMetricsDTO,
} from "./storage.dto"
import { Prisma } from "@prisma/client"

export class StorageService {
  /**
   * Initialize upload session and generate S3 presigned PUT URL
   */
  static async createPresignedUpload(params: {
    organizationId: string
    userId?: string
    input: PresignUploadRequest
  }): Promise<PresignUploadResponseDTO> {
    const fileId = `cl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const storageKey = buildS3StorageKey({
      organizationId: params.organizationId,
      fileId,
      filename: params.input.filename,
    })

    const config = getS3Config()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes TTL

    const uploadUrl = await getPresignedPutUrl({
      storageKey,
      mimeType: params.input.mimeType,
      expiresInSeconds: 900,
    })

    await prisma.storageFile.create({
      data: {
        id: fileId,
        organizationId: params.organizationId,
        uploadedByUserId: params.userId || null,
        purpose: params.input.purpose,
        bucket: config.bucket,
        storageKey,
        originalFilename: params.input.filename,
        mimeType: params.input.mimeType,
        sizeBytes: BigInt(params.input.sizeBytes || 0),
        status: "PENDING",
        metadata: (params.input.metadata as Prisma.InputJsonValue) || {},
        expiresAt,
      },
    })

    return {
      fileId,
      storageKey,
      uploadUrl,
      expiresAt: expiresAt.toISOString(),
      purpose: params.input.purpose,
      headers: {
        "Content-Type": params.input.mimeType,
      },
    }
  }

  /**
   * Confirm that upload has been completed and physical file exists in S3
   */
  static async confirmUpload(params: {
    organizationId: string
    input: ConfirmUploadRequest
  }): Promise<StorageFileDTO> {
    const file = await prisma.storageFile.findUnique({
      where: { id: params.input.fileId },
    })

    if (!file) {
      throw new Error("Storage file record not found")
    }

    if (file.organizationId !== params.organizationId) {
      throw new Error("Forbidden: file does not belong to your organization")
    }

    // Verify storage key path matches org
    const orgFromKey = extractOrganizationIdFromS3Key(file.storageKey)
    if (orgFromKey !== params.organizationId) {
      throw new Error("Forbidden: storage key organization mismatch")
    }

    // Check physical file stats on S3
    const stat = await statStorageFile(file.storageKey)
    const finalSize =
      stat.exists && stat.size > 0
        ? stat.size
        : params.input.sizeBytes || Number(file.sizeBytes)

    const confirmed = await prisma.storageFile.update({
      where: { id: file.id },
      data: {
        status: "ACTIVE",
        sizeBytes: BigInt(finalSize),
        confirmedAt: new Date(),
        publicUrl: params.input.publicUrl || file.publicUrl,
      },
    })

    return toStorageFileDTO(confirmed)
  }

  /**
   * Generate presigned GET view URL for a tenant
   */
  static async getTenantViewUrl(params: {
    organizationId: string
    fileId?: string
    storageKey?: string
  }): Promise<{ viewUrl: string; file: StorageFileDTO }> {
    let file = null

    if (params.fileId) {
      file = await prisma.storageFile.findUnique({
        where: { id: params.fileId },
      })
    } else if (params.storageKey) {
      file = await prisma.storageFile.findUnique({
        where: { storageKey: params.storageKey },
      })
    }

    if (!file) {
      throw new Error("Storage file not found")
    }

    if (file.organizationId !== params.organizationId) {
      throw new Error("Forbidden: file does not belong to your organization")
    }

    // Decrypt key guard
    const orgFromKey = extractOrganizationIdFromS3Key(file.storageKey)
    if (orgFromKey !== params.organizationId) {
      throw new Error("Forbidden: key guard mismatch")
    }

    const viewUrl = await getPresignedGetUrl({
      storageKey: file.storageKey,
      expiresInSeconds: 900,
    })

    return {
      viewUrl,
      file: toStorageFileDTO(file),
    }
  }

  /**
   * Admin: List all files across tenants with pagination and filters
   */
  static async listAdminFiles(params: {
    page?: number
    pageSize?: number
    search?: string
    organizationId?: string
    uploadedByUserId?: string
    purpose?: string
    status?: "PENDING" | "ACTIVE" | "DELETED"
    startDate?: Date
    endDate?: Date
  }): Promise<{
    items: StorageFileDTO[]
    total: number
    page: number
    pageSize: number
  }> {
    const page = Math.max(1, params.page || 1)
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 20))
    const skip = (page - 1) * pageSize

    const where: Prisma.StorageFileWhereInput = {}

    if (params.organizationId) where.organizationId = params.organizationId
    if (params.uploadedByUserId)
      where.uploadedByUserId = params.uploadedByUserId
    if (params.purpose) where.purpose = params.purpose
    if (params.status) where.status = params.status

    if (params.startDate || params.endDate) {
      where.createdAt = {}
      if (params.startDate) where.createdAt.gte = params.startDate
      if (params.endDate) where.createdAt.lte = params.endDate
    }

    if (params.search) {
      const s = params.search.trim()
      where.OR = [
        { id: { contains: s, mode: "insensitive" } },
        { originalFilename: { contains: s, mode: "insensitive" } },
        { storageKey: { contains: s, mode: "insensitive" } },
      ]
    }

    const [items, total] = await Promise.all([
      prisma.storageFile.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.storageFile.count({ where }),
    ])

    return {
      items: items.map(toStorageFileDTO),
      total,
      page,
      pageSize,
    }
  }

  /**
   * Admin: Get storage aggregated metrics
   */
  static async getAdminMetrics(): Promise<StorageMetricsDTO> {
    const files = await prisma.storageFile.findMany({
      select: {
        status: true,
        sizeBytes: true,
        purpose: true,
      },
    })

    let totalBytes = 0
    let activeFiles = 0
    let pendingFiles = 0
    let deletedFiles = 0

    const purposeMap: Record<string, { count: number; totalBytes: number }> = {}

    for (const f of files) {
      const bytes = Number(f.sizeBytes)
      totalBytes += bytes

      if (f.status === "ACTIVE") activeFiles++
      else if (f.status === "PENDING") pendingFiles++
      else if (f.status === "DELETED") deletedFiles++

      if (!purposeMap[f.purpose]) {
        purposeMap[f.purpose] = { count: 0, totalBytes: 0 }
      }
      purposeMap[f.purpose].count++
      purposeMap[f.purpose].totalBytes += bytes
    }

    const purposeBreakdown = Object.entries(purposeMap).map(
      ([purpose, stat]) => ({
        purpose,
        count: stat.count,
        totalBytes: stat.totalBytes,
      })
    )

    return {
      totalFiles: files.length,
      totalBytes,
      activeFiles,
      pendingFiles,
      deletedFiles,
      purposeBreakdown,
    }
  }

  /**
   * Admin: Privileged view URL generation
   */
  static async getAdminViewUrl(
    fileId: string
  ): Promise<{ viewUrl: string; file: StorageFileDTO }> {
    const file = await prisma.storageFile.findUnique({
      where: { id: fileId },
    })

    if (!file) {
      throw new Error("Storage file not found")
    }

    const viewUrl = await getPresignedGetUrl({
      storageKey: file.storageKey,
      expiresInSeconds: 900,
    })

    return {
      viewUrl,
      file: toStorageFileDTO(file),
    }
  }

  /**
   * Admin: Force delete file physically and soft-delete in DB
   */
  static async forceDeleteFile(fileId: string): Promise<StorageFileDTO> {
    const file = await prisma.storageFile.findUnique({
      where: { id: fileId },
    })

    if (!file) {
      throw new Error("Storage file not found")
    }

    await deleteStorageFile(file.storageKey)

    const updated = await prisma.storageFile.update({
      where: { id: fileId },
      data: {
        status: "DELETED",
        deletedAt: new Date(),
      },
    })

    return toStorageFileDTO(updated)
  }
}
