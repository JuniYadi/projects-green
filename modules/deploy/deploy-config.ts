import {
  buildStepSchema,
  environmentStepSchema,
  sourceStepSchema,
} from "@/modules/deploy/deploy.schema"
import type {
  DeployBuildState,
  DeployEnvironmentState,
  DeploySourceState,
  DeployWizardState,
  DetectionResult,
  EnvVar,
} from "@/modules/deploy/deploy.types"
import { isManualOverrideRequired } from "@/modules/deploy/deploy.schema"

/**
 * PGREEN-068 — Deploy Config Persistence
 *
 * A single, validated deploy configuration ("draft") that assembles the
 * source, build, and environment wizard steps into one durable contract
 * ready to be handed to deployment orchestration (PGREEN-070) and the
 * billing gate (PGREEN-069).
 *
 * The wizard state itself persists to sessionStorage (deploy.store.tsx);
 * this module is the validation + assembly boundary between that transient
 * wizard state and any durable stack/deployment creation.
 */

export const DEFAULT_PAYG_BUFFER_HOURS = 24

export type DeployConfigDomain =
  | { mode: "generated" }
  | { mode: "custom"; customDomain: string }

export type DeployConfigBuild = {
  language: string
  framework: string
  buildCommand: string
  useDockerfile: boolean
}

export type DeployConfigEnvVar = Pick<EnvVar, "key" | "value"> & {
  type: "plain" | "secret"
  scope: "all" | "build" | "runtime"
  isStoredSecret: boolean
}

export type DeployConfig = {
  source: {
    sourceType: "github"
    ownerId: string
    repositoryId: string
    branchName: string
    rootDirectory: string
  }
  build: DeployConfigBuild
  environment: {
    domain: DeployConfigDomain
    envVars: DeployConfigEnvVar[]
    resourcePlanId: "starter" | "pro" | "payg"
    billingMode: "PAYG" | "PACKAGE"
    paygBufferHours: number
    cpu?: number
    memory?: number
  }
  detection: {
    confidence: number
    status: DetectionResult["status"]
  } | null
}

export type DeployConfigValidationError = {
  field: string
  message: string
}

export type DeployConfigResult =
  | { ok: true; config: DeployConfig }
  | { ok: false; errors: DeployConfigValidationError[] }

const normalizeEnvVar = (item: EnvVar): DeployConfigEnvVar => {
  return {
    key: item.key.trim(),
    value: item.value,
    type: item.type ?? "plain",
    scope: item.scope ?? "all",
    isStoredSecret: Boolean(item.isStoredSecret),
  }
}

const collectSourceErrors = (
  source: DeploySourceState
): DeployConfigValidationError[] => {
  // App Hosting MVP is private-repo first: only github source is durable here.
  if (source.sourceType !== "github") {
    return [
      {
        field: "source.sourceType",
        message: "Only GitHub repository sources are supported for deploy drafts.",
      },
    ]
  }

  const parsed = sourceStepSchema.safeParse(source)
  if (parsed.success) {
    return []
  }

  return parsed.error.issues.map((issue) => ({
    field: `source.${issue.path.join(".") || "root"}`,
    message: issue.message,
  }))
}

const collectBuildErrors = (
  build: DeployBuildState,
  detection: DetectionResult | null
): DeployConfigValidationError[] => {
  // Build inputs are only required when the detector cannot stand on its own.
  if (!isManualOverrideRequired(detection)) {
    return []
  }

  const parsed = buildStepSchema.safeParse(build)
  if (parsed.success) {
    return []
  }

  return parsed.error.issues.map((issue) => ({
    field: `build.${issue.path.join(".") || "root"}`,
    message: issue.message,
  }))
}

const collectEnvironmentErrors = (
  environment: DeployEnvironmentState
): DeployConfigValidationError[] => {
  const parsed = environmentStepSchema.safeParse(environment)
  if (parsed.success) {
    return []
  }

  return parsed.error.issues.map((issue) => ({
    field: `environment.${issue.path.join(".") || "root"}`,
    message: issue.message,
  }))
}

/**
 * Validate + assemble a wizard state into a durable deploy config.
 *
 * Returns an explicit error list when any step is invalid so progression
 * can be blocked with field-specific feedback (use case 11 edge paths).
 */
export const buildDeployConfig = (
  state: Pick<
    DeployWizardState,
    "source" | "build" | "environment" | "detectionResult"
  >
): DeployConfigResult => {
  const errors: DeployConfigValidationError[] = [
    ...collectSourceErrors(state.source),
    ...collectBuildErrors(state.build, state.detectionResult),
    ...collectEnvironmentErrors(state.environment),
  ]

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  const environment = environmentStepSchema.parse(state.environment)
  const useGenerated = environment.useGeneratedSubdomain

  const domain: DeployConfigDomain = useGenerated
    ? { mode: "generated" }
    : { mode: "custom", customDomain: environment.customDomain.trim() }

  const config: DeployConfig = {
    source: {
      sourceType: "github",
      ownerId: state.source.ownerId.trim(),
      repositoryId: state.source.repositoryId.trim(),
      branchName: state.source.branchName.trim(),
      rootDirectory: state.source.rootDirectory.trim() || "/",
    },
    build: {
      language: state.build.language.trim(),
      framework: state.build.framework.trim(),
      buildCommand: state.build.buildCommand.trim(),
      useDockerfile: state.build.useDockerfile,
    },
    environment: {
      domain,
      envVars: environment.envVars.map(normalizeEnvVar),
      resourcePlanId: environment.resourcePlanId,
      billingMode: environment.billingMode,
      paygBufferHours: environment.paygBufferHours,
      cpu: environment.cpu,
      memory: environment.memory,
    },
    detection: state.detectionResult
      ? {
          confidence: state.detectionResult.confidence,
          status: state.detectionResult.status,
        }
      : null,
  }

  return { ok: true, config }
}

/**
 * Boolean convenience guard for "can this draft proceed to billing/deploy?".
 */
export const isDeployConfigValid = (
  state: Pick<
    DeployWizardState,
    "source" | "build" | "environment" | "detectionResult"
  >
): boolean => {
  return buildDeployConfig(state).ok
}
