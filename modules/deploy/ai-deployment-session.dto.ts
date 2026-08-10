import type { AiDeploymentSession } from "@prisma/client"

import {
  toDeploymentPlanDTO,
  type DeploymentPlanDTO,
} from "@/modules/deploy/deployment-plan.dto"

export type AiDeploymentSessionDTO = {
  id: string
  status: AiDeploymentSession["status"]
  sourceType: AiDeploymentSession["sourceType"]
  currentPlanVersion: number
  currentPlanHash: string | null
  plan: DeploymentPlanDTO | null
  blockedReason: string | null
  confirmedAt: string | null
  confirmationPlanHash: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

export function toAiDeploymentSessionDTO(
  session: AiDeploymentSession
): AiDeploymentSessionDTO {
  return {
    id: session.id,
    status: session.status,
    sourceType: session.sourceType,
    currentPlanVersion: session.currentPlanVersion,
    currentPlanHash: session.currentPlanHash,
    plan: toDeploymentPlanDTO(session.plan),
    blockedReason: session.blockedReason,
    confirmedAt: session.confirmedAt?.toISOString() ?? null,
    confirmationPlanHash: session.confirmationPlanHash,
    expiresAt: session.expiresAt?.toISOString() ?? null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  }
}
