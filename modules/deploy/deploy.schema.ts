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
import { ENV_VAR_MAX_VALUE_SIZE } from "@/modules/deploy/environment-vars"

export const CUSTOM_DOMAIN_PATTERN =
  /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i

export const ENV_VAR_KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/

export const isValidCustomDomain = (value: string) => {
  const normalizedValue = value.trim().toLowerCase()
  if (!normalizedValue) {
    return false
  }

  if (
    normalizedValue.includes("://") ||
    normalizedValue.includes("/") ||
    normalizedValue.includes(" ")
  ) {
    return false
  }

  return CUSTOM_DOMAIN_PATTERN.test(normalizedValue)
}

export const isValidEnvVarKey = (value: string) => {
  return ENV_VAR_KEY_PATTERN.test(value.trim())
}

export const sourceStepSchema = z.object({
  ownerId: z.string().trim().min(1, "Owner is required."),
  repositoryId: z.string().trim().min(1, "Repository is required."),
  branchName: z.string().trim().min(1, "Branch is required."),
  rootDirectory: z.string().trim().min(1, "Root directory is required."),
})

const envVarSchema = z.object({
  id: z.string().trim().min(1),
  key: z.string().trim().min(1, "Environment key is required."),
  value: z.string().max(
    ENV_VAR_MAX_VALUE_SIZE,
    `Environment value cannot exceed ${ENV_VAR_MAX_VALUE_SIZE} characters.`
  ),
  type: z.enum(["plain", "secret"]).optional(),
  scope: z.enum(["all", "build", "runtime"]).optional(),
  lastUpdatedAt: z.string().optional(),
  isStoredSecret: z.boolean().optional(),
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
    const normalizedDomain = value.customDomain.trim()

    if (!value.useGeneratedSubdomain && !normalizedDomain) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customDomain"],
        message: "Custom domain is required when generated subdomain is off.",
      })
    }

    if (
      !value.useGeneratedSubdomain &&
      normalizedDomain &&
      !isValidCustomDomain(normalizedDomain)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customDomain"],
        message: "Enter a valid domain such as app.example.com.",
      })
    }

    const invalidKey = value.envVars.find((item) => {
      const normalizedKey = item.key.trim()

      if (!normalizedKey) {
        return false
      }

      return !isValidEnvVarKey(normalizedKey)
    })

    if (invalidKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["envVars"],
        message:
          "Environment keys must use uppercase letters, numbers, or underscores.",
      })
    }

    const missingValue = value.envVars.find((item) => {
      const hasStoredSecret = item.type === "secret" && item.isStoredSecret
      if (hasStoredSecret) {
        return false
      }

      return item.value.trim().length === 0
    })

    if (missingValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["envVars"],
        message: "Environment value is required.",
      })
    }

    const normalizedKeys = value.envVars
      .map((item) => item.key.trim().toLowerCase())
      .filter((key) => key.length > 0)

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

export const validateEnvironmentStep = (
  environment: DeployEnvironmentState
) => {
  return environmentStepSchema.safeParse(environment).success
}

export const validateEnvVarKeysUnique = (envVars: EnvVar[]): boolean => {
  const keys = envVars
    .map((item) => item.key.trim().toLowerCase())
    .filter((key) => key.length > 0)
  return keys.length === new Set(keys).size
}

export const getEnvironmentValidationMessages = (
  environment: DeployEnvironmentState
) => {
  const parsed = environmentStepSchema.safeParse(environment)
  if (parsed.success) {
    return []
  }

  return Array.from(new Set(parsed.error.issues.map((issue) => issue.message)))
}
