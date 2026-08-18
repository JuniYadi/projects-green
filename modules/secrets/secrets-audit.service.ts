import { prisma } from "@/lib/prisma"

export type VaultSecretRevealAudit = {
  organizationId: string
  stackId: string
  workosUserId: string
  environment: string
  secretKey: string
}

export const logVaultSecretReveal = async (
  event: VaultSecretRevealAudit
): Promise<void> => {
  await prisma.vaultSecretAuditLog.create({
    data: {
      organizationId: event.organizationId,
      stackId: event.stackId,
      workosUserId: event.workosUserId,
      environment: event.environment,
      secretKey: event.secretKey,
      action: "SECRET_REVEALED",
    },
  })
}
