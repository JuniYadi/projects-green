import { z } from "zod"
import type { AppManagedServiceType } from "@prisma/client"

export const reinstallPreflightQuerySchema = z.object({
  targetTemplateId: z.string().trim().min(1, "targetTemplateId is required"),
})

export type ReinstallPreflightQuery = z.infer<
  typeof reinstallPreflightQuerySchema
>

export type StoragePreservationPolicy =
  "PRESERVE_OLD_DETACH_AND_FRESH_VOLUME" | "REUSE_COMPATIBLE" | "NONE"

export type PreflightTemplateSummaryDTO = {
  id: string
  slug: string
  name: string
  version: string
  image: string
  deploymentType: "deployment" | "statefulset"
  port: number
  storagePath: string | null
}

export type PreflightDiffDTO = {
  workloadKind: {
    current: "deployment" | "statefulset"
    target: "deployment" | "statefulset"
    changed: boolean
  }
  port: {
    current: number
    target: number
    changed: boolean
  }
  image: {
    current: string
    target: string
    changed: boolean
  }
  storage: {
    currentPath: string | null
    targetPath: string | null
    policy: StoragePreservationPolicy
    warning?: string
  }
}

export type PreflightDependencyDTO = {
  requiredServiceType: AppManagedServiceType | null
  managedStockAvailable: boolean
  availableStockCount: number
  allowedModes: Array<"MANAGED" | "BYOD">
  notice?: string
}

export type PreflightEnvSchemaDTO = {
  key: string
  label: string
  description?: string
  defaultValue?: string
  isSecret: boolean
  dataType: string
}

export type PreflightEnvDiffDTO = {
  preservedEnvs: string[]
  requiredEnvs: PreflightEnvSchemaDTO[]
  obsoleteEnvs: string[]
}

export type ReinstallPreflightResponseDTO = {
  currentTemplate: PreflightTemplateSummaryDTO
  targetTemplate: PreflightTemplateSummaryDTO
  diff: PreflightDiffDTO
  dependencies: PreflightDependencyDTO
  envDiff: PreflightEnvDiffDTO
  canProceed: boolean
  blockReason?: string
}

export const reinstallRequestSchema = z.object({
  targetTemplateId: z.string().trim().min(1, "Target template ID is required"),
  dependencyMode: z.enum(["MANAGED", "BYOD"]).optional(),
  byodCredentials: z
    .object({
      host: z.string().trim().min(1, "Host is required"),
      port: z.number().int().min(1).max(65535),
      database: z.string().trim().min(1, "Database name is required"),
      user: z.string().trim().min(1, "User is required"),
      password: z.string().min(1, "Password is required"),
    })
    .optional(),
  customEnvs: z.record(z.string(), z.string()).optional(),
})

export type ReinstallRequestDTO = z.infer<typeof reinstallRequestSchema>

export type ReinstallResultDTO = {
  ok: boolean
  stackId: string
  slug: string
  deploymentId: string
  commitSha: string | null
  snapshotId: string
  message: string
}

export const rollbackRequestSchema = z.object({
  snapshotId: z.string().trim().optional(),
})

export type RollbackRequestDTO = z.infer<typeof rollbackRequestSchema>

export type RollbackResultDTO = {
  ok: boolean
  stackId: string
  slug: string
  deploymentId: string
  commitSha: string | null
  restoredTemplateId: string
  message: string
}

export type StackConfigSnapshot = {
  id: string
  createdAt: string
  templateId: string | null
  templateVersion: string | null
  templateName: string | null
  imageRepository: string | null
  deploymentType: "deployment" | "statefulset" | null
  defaultPort: number | null
  additionalPorts: Array<{ port: number; name: string }> | null
  command: string[] | null
  args: string[] | null
  healthCheckPath: string | null
  livenessProbe: unknown | null
  readinessProbe: unknown | null
  startupProbe: unknown | null
  envVars: unknown[]
  metadata: Record<string, unknown>
  managedStockId?: string | null
}
