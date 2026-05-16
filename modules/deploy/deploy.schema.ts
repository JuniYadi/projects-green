import { z } from "zod"

import {
  HIGH_CONFIDENCE_THRESHOLD,
  LOW_CONFIDENCE_THRESHOLD,
} from "@/modules/deploy/deploy.constants"
import type {
  DeployBuildState,
  DeployEnvironmentState,
  DeploySourceState,
  DetectionResult,
  EnvVar,
} from "@/modules/deploy/deploy.types"

export const sourceStepSchema = z.object({
  ownerId: z.string().trim().min(1, "Owner is required."),
  repositoryId: z.string().trim().min(1, "Repository is required."),
  branchName: z.string().trim().min(1, "Branch is required."),
  rootDirectory: z.string().trim().min(1, "Root directory is required."),
})

const envVarSchema = z.object({
  id: z.string().trim().min(1),
  key: z.string().trim().min(1, "Environment key is required."),
  value: z.string().trim().min(1, "Environment value is required."),
  masked: z.boolean().optional(),
})

export const environmentStepSchema = z
  .object({
    useGeneratedSubdomain: z.boolean(),
    customDomain: z.string().trim(),
    envVars: z.array(envVarSchema),
    resourcePlanId: z.enum(["starter", "pro"]),
  })
  .superRefine((value, ctx) => {
    if (!value.useGeneratedSubdomain && !value.customDomain.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customDomain"],
        message: "Custom domain is required when generated subdomain is off.",
      })
    }

    const normalizedKeys = value.envVars.map((item) => item.key.toLowerCase())

    const duplicate = normalizedKeys.find((key, index) => {
      return normalizedKeys.indexOf(key) !== index
    })

    if (duplicate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["envVars"],
        message: "Environment variable keys must be unique.",
      })
    }
  })

export const buildStepSchema = z
  .object({
    language: z.string(),
    framework: z.string(),
    buildCommand: z.string(),
    useDockerfile: z.boolean(),
  })
  .superRefine((value, ctx) => {
    const hasManualValues =
      value.language.trim().length > 0 &&
      value.framework.trim().length > 0 &&
      value.buildCommand.trim().length > 0

    if (!value.useDockerfile && !hasManualValues) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Manual setup is required. Fill language/framework/build command or use Dockerfile.",
      })
    }
  })

export const isManualOverrideRequired = (
  detectionResult: DetectionResult | null
): boolean => {
  if (!detectionResult) {
    return true
  }

  if (detectionResult.status === "failed") {
    return true
  }

  return detectionResult.confidence < LOW_CONFIDENCE_THRESHOLD
}

export const isHighConfidence = (detectionResult: DetectionResult | null) => {
  return Boolean(
    detectionResult && detectionResult.confidence >= HIGH_CONFIDENCE_THRESHOLD
  )
}

export const isMediumConfidence = (detectionResult: DetectionResult | null) => {
  if (!detectionResult) {
    return false
  }

  return (
    detectionResult.confidence >= LOW_CONFIDENCE_THRESHOLD &&
    detectionResult.confidence < HIGH_CONFIDENCE_THRESHOLD
  )
}

export const validateSourceStep = (source: DeploySourceState) => {
  return sourceStepSchema.safeParse(source).success
}

export const validateBuildStep = (
  build: DeployBuildState,
  detectionResult: DetectionResult | null
) => {
  if (!isManualOverrideRequired(detectionResult)) {
    return true
  }

  return buildStepSchema.safeParse(build).success
}

export const validateEnvironmentStep = (environment: DeployEnvironmentState) => {
  return environmentStepSchema.safeParse(environment).success
}

export const validateEnvVarKeysUnique = (envVars: EnvVar[]): boolean => {
  const keys = envVars.map((item) => item.key.trim().toLowerCase())
  return keys.length === new Set(keys).size
}
