import type { ApplicationContainerImage } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  toContainerImageDTO,
  type ContainerImageDTO,
} from "./security-artifacts.dto"

export const FREE_TIER_MAX_RETAINED_IMAGES = 3

export type RegisterContainerImageInput = {
  organizationId: string
  stackId: string
  deploymentId?: string | null
  buildNumber: number
  imageTag: string
  digest?: string | null
  sizeBytes?: bigint | number | string | null
}

export type RollbackValidationResult =
  | { allowed: true; image: ApplicationContainerImage }
  | { allowed: false; reason: string; image?: ApplicationContainerImage }

export async function registerContainerImage(
  input: RegisterContainerImageInput
): Promise<ApplicationContainerImage> {
  const sizeBytesBigInt =
    input.sizeBytes !== undefined && input.sizeBytes !== null
      ? BigInt(input.sizeBytes)
      : null

  return prisma.$transaction(async (tx) => {
    // 1. Demote any currently ACTIVE images for this stack to READY
    await tx.applicationContainerImage.updateMany({
      where: {
        stackId: input.stackId,
        status: "ACTIVE",
      },
      data: {
        status: "READY",
      },
    })

    // 2. Register/Upsert this new image as ACTIVE
    const registeredImage = await tx.applicationContainerImage.upsert({
      where: {
        stackId_imageTag: {
          stackId: input.stackId,
          imageTag: input.imageTag,
        },
      },
      update: {
        organizationId: input.organizationId,
        deploymentId: input.deploymentId ?? null,
        buildNumber: input.buildNumber,
        digest: input.digest ?? null,
        sizeBytes: sizeBytesBigInt,
        status: "ACTIVE",
        pushedAt: new Date(),
        rotatedAt: null,
      },
      create: {
        organizationId: input.organizationId,
        stackId: input.stackId,
        deploymentId: input.deploymentId ?? null,
        buildNumber: input.buildNumber,
        imageTag: input.imageTag,
        digest: input.digest ?? null,
        sizeBytes: sizeBytesBigInt,
        status: "ACTIVE",
        pushedAt: new Date(),
      },
    })

    // 3. Enforce 3-image retention policy
    // Fetch non-purged images for this stack ordered by pushedAt descending
    const allImages = await tx.applicationContainerImage.findMany({
      where: {
        stackId: input.stackId,
        status: { not: "PURGED" },
      },
      orderBy: { pushedAt: "desc" },
    })

    // Retain only the first 3 images (index 0, 1, 2)
    // Images at index 3+ that are currently READY transition to EXPIRED
    if (allImages.length > FREE_TIER_MAX_RETAINED_IMAGES) {
      const imagesToRotate = allImages.slice(FREE_TIER_MAX_RETAINED_IMAGES)
      const idsToRotate = imagesToRotate
        .filter((img) => img.status === "READY")
        .map((img) => img.id)

      if (idsToRotate.length > 0) {
        await tx.applicationContainerImage.updateMany({
          where: {
            id: { in: idsToRotate },
          },
          data: {
            status: "EXPIRED",
            rotatedAt: new Date(),
          },
        })
      }
    }

    return registeredImage
  })
}

export async function getStackContainerImages(
  stackId: string,
  organizationId: string
): Promise<ContainerImageDTO[]> {
  const images = await prisma.applicationContainerImage.findMany({
    where: {
      stackId,
      organizationId,
    },
    include: {
      securityScan: true,
    },
    orderBy: { pushedAt: "desc" },
  })

  return images.map(toContainerImageDTO)
}

export async function validateRollbackImage(
  stackId: string,
  imageId: string,
  organizationId: string
): Promise<RollbackValidationResult> {
  const image = await prisma.applicationContainerImage.findFirst({
    where: {
      id: imageId,
      stackId,
      organizationId,
    },
  })

  if (!image) {
    return {
      allowed: false,
      reason: "Container image not found for this stack.",
    }
  }

  if (image.status === "ACTIVE") {
    return {
      allowed: false,
      reason: "This container image is already the active live deployment.",
      image,
    }
  }

  if (image.status === "EXPIRED" || image.status === "PURGED") {
    return {
      allowed: false,
      reason:
        "This image has been auto-rotated to save space. Please trigger a new build from this commit to deploy.",
      image,
    }
  }

  if (image.status !== "READY") {
    return {
      allowed: false,
      reason: `Image status is ${image.status}, which is not ready for rollback.`,
      image,
    }
  }

  return {
    allowed: true,
    image,
  }
}
