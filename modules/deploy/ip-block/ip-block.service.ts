import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import {
  isValidIpAddress,
  normalizeIpAddress,
} from "../opensearch/traffic-classification.service"
import {
  defaultIpBlockAdapter,
  type IpBlockEnforcementAdapter,
} from "./ip-block.adapter"
import type { AppHostingIpBlockDTO } from "../opensearch/opensearch-traffic.types"

export type BlockDurationOption = "1h" | "24h" | "7d" | "permanent"

export interface BlockIpInput {
  stackId: string
  organizationId: string
  ipAddress: string
  reason: string
  duration: BlockDurationOption
  actorId: string
  adapter?: IpBlockEnforcementAdapter
}

export interface UnblockIpInput {
  stackId: string
  organizationId: string
  ipAddress: string
  actorId: string
  reason?: string
  adapter?: IpBlockEnforcementAdapter
}

export function parseDurationToMinutes(
  duration: BlockDurationOption
): number | null {
  switch (duration) {
    case "1h":
      return 60
    case "24h":
      return 1440
    case "7d":
      return 10080
    case "permanent":
      return null
    default:
      return 1440
  }
}

export function toIpBlockDTO(block: {
  id: string
  stackId: string
  organizationId: string
  ipAddress: string
  reason: string
  durationMinutes: number | null
  status: string
  errorMessage: string | null
  enforcedAt: Date | null
  expiresAt: Date | null
  revokedAt: Date | null
  revokedBy: string | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
}): AppHostingIpBlockDTO {
  return {
    id: block.id,
    stackId: block.stackId,
    organizationId: block.organizationId,
    ipAddress: block.ipAddress,
    reason: block.reason,
    durationMinutes: block.durationMinutes,
    status: block.status as AppHostingIpBlockDTO["status"],
    errorMessage: block.errorMessage,
    enforcedAt: block.enforcedAt ? block.enforcedAt.toISOString() : null,
    expiresAt: block.expiresAt ? block.expiresAt.toISOString() : null,
    revokedAt: block.revokedAt ? block.revokedAt.toISOString() : null,
    revokedBy: block.revokedBy,
    createdBy: block.createdBy,
    createdAt: block.createdAt.toISOString(),
    updatedAt: block.updatedAt.toISOString(),
  }
}

export async function blockIpAddress(
  input: BlockIpInput
): Promise<AppHostingIpBlockDTO> {
  const {
    stackId,
    organizationId,
    ipAddress,
    reason,
    duration,
    actorId,
    adapter = defaultIpBlockAdapter,
  } = input

  if (!isValidIpAddress(ipAddress)) {
    throw new Error(
      `Invalid IP address: '${ipAddress}'. Only exact IPv4 or IPv6 addresses are accepted.`
    )
  }
  const normalizedIp = normalizeIpAddress(ipAddress)

  const trimmedReason = reason?.trim() ?? ""
  if (!trimmedReason) {
    throw new Error("A valid reason is required to block an IP address.")
  }
  if (trimmedReason.length > 500) {
    throw new Error("Reason must not exceed 500 characters.")
  }

  // Prevent duplicate active blocks for the same IP on the same stack
  const existingBlock = await prisma.appHostingIpBlock.findFirst({
    where: {
      stackId,
      ipAddress: normalizedIp,
      status: { in: ["active", "pending"] },
    },
  })
  if (existingBlock) {
    throw new Error(
      `IP ${normalizedIp} already has an ${existingBlock.status} block. Unblock it first before creating a new one.`
    )
  }

  const durationMinutes = parseDurationToMinutes(duration)
  const now = new Date()
  const expiresAt = durationMinutes
    ? new Date(now.getTime() + durationMinutes * 60 * 1000)
    : null

  // Create block record in pending state
  const block = await prisma.appHostingIpBlock.create({
    data: {
      stackId,
      organizationId,
      ipAddress: normalizedIp,
      reason: trimmedReason,
      durationMinutes,
      status: "pending",
      expiresAt,
      createdBy: actorId,
    },
  })

  // Attempt enforcement through adapter
  const result = await adapter.applyBlock({
    stackId,
    organizationId,
    ipAddress: normalizedIp,
  })

  if (result.success) {
    const updated = await prisma.appHostingIpBlock.update({
      where: { id: block.id },
      data: {
        status: "active",
        enforcedAt: new Date(),
        errorMessage: null,
      },
    })
    logger.info(
      {
        event: "IP_BLOCK_CREATED",
        stackId,
        ipAddress: normalizedIp,
        blockId: block.id,
      },
      `Successfully created active IP block for ${normalizedIp}`
    )
    return toIpBlockDTO(updated)
  }

  // Enforcement failed — mark status failed explicitly without claiming active block
  const failedBlock = await prisma.appHostingIpBlock.update({
    where: { id: block.id },
    data: {
      status: "failed",
      errorMessage: result.error || "Cluster ingress enforcement failed",
    },
  })
  logger.warn(
    {
      event: "IP_BLOCK_ENFORCEMENT_FAILED",
      stackId,
      ipAddress: normalizedIp,
      blockId: block.id,
      error: result.error,
    },
    `IP block created in failed state for ${normalizedIp}`
  )
  return toIpBlockDTO(failedBlock)
}

export async function unblockIpAddress(
  input: UnblockIpInput
): Promise<AppHostingIpBlockDTO> {
  const {
    stackId,
    organizationId,
    ipAddress,
    actorId,
    adapter = defaultIpBlockAdapter,
  } = input

  if (!isValidIpAddress(ipAddress)) {
    throw new Error(`Invalid IP address: '${ipAddress}'`)
  }
  const normalizedIp = normalizeIpAddress(ipAddress)

  const activeBlock = await prisma.appHostingIpBlock.findFirst({
    where: {
      stackId,
      organizationId,
      ipAddress: normalizedIp,
      status: { in: ["active", "pending", "failed"] },
    },
    orderBy: { createdAt: "desc" },
  })

  if (!activeBlock) {
    throw new Error(
      `No active or pending block found for IP: ${normalizedIp} on this application.`
    )
  }

  // Remove from cluster enforcement adapter
  await adapter.removeBlock({
    stackId,
    organizationId,
    ipAddress: normalizedIp,
  })

  const revoked = await prisma.appHostingIpBlock.update({
    where: { id: activeBlock.id },
    data: {
      status: "revoked",
      revokedAt: new Date(),
      revokedBy: actorId,
    },
  })

  logger.info(
    {
      event: "IP_BLOCK_REVOKED",
      stackId,
      ipAddress: normalizedIp,
      blockId: activeBlock.id,
    },
    `Revoked IP block for ${normalizedIp}`
  )

  return toIpBlockDTO(revoked)
}

export async function listAppIpBlocks(
  stackId: string,
  organizationId: string,
  adapter: IpBlockEnforcementAdapter = defaultIpBlockAdapter
): Promise<AppHostingIpBlockDTO[]> {
  const blocks = await prisma.appHostingIpBlock.findMany({
    where: {
      stackId,
      organizationId,
    },
    orderBy: { createdAt: "desc" },
  })

  const now = new Date()
  const result: AppHostingIpBlockDTO[] = []

  for (const block of blocks) {
    // Check if active block has expired
    if (
      block.status === "active" &&
      block.expiresAt &&
      new Date(block.expiresAt) < now
    ) {
      try {
        await prisma.appHostingIpBlock.update({
          where: { id: block.id },
          data: { status: "expired" },
        })
        await adapter.removeBlock({
          stackId,
          organizationId,
          ipAddress: block.ipAddress,
        })
        result.push(toIpBlockDTO({ ...block, status: "expired" }))
      } catch (err) {
        logger.warn(
          {
            event: "EXPIRED_BLOCK_RECONCILE_FAILED",
            blockId: block.id,
            error: err instanceof Error ? err.message : String(err),
          },
          "Failed to reconcile expired block"
        )
        result.push(toIpBlockDTO(block))
      }
    } else {
      result.push(toIpBlockDTO(block))
    }
  }

  return result
}
