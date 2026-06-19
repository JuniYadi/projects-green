import {
  isManualOverrideRequired,
  validateBuildStep,
  validateEnvironmentStep,
  validateSourceStep,
} from "@/modules/deploy/deploy.schema"
import type {
  DeploySourceType,
  DeployStatus,
  DeployStep,
  DeployWizardState,
  DetectionResult,
} from "@/modules/deploy/deploy.types"

export const getAvailableStepsList = (
  sourceType: DeploySourceType
): DeployStep[] => {
  if (sourceType === "template") {
    return ["source", "environment", "monitor"]
  }
  return ["source", "build", "environment", "monitor"]
}

export const getStepIndex = (
  step: DeployStep,
  sourceType: DeploySourceType
): number => {
  return getAvailableStepsList(sourceType).indexOf(step)
}

export const getNextStep = (
  step: DeployStep,
  state: {
    source: { sourceType: DeploySourceType }
    detectionResult: DetectionResult | null
  }
): DeployStep | null => {
  const { sourceType } = state.source
  if (sourceType === "template") {
    if (step === "source") return "environment"
    if (step === "environment") return "monitor"
    return null
  }

  // For GitHub source:
  if (step === "source") {
    // Skip Build step if manual override is not required (high-confidence auto-detection)
    if (!isManualOverrideRequired(state.detectionResult)) {
      return "environment"
    }
    return "build"
  }
  if (step === "build") {
    return "environment"
  }
  if (step === "environment") {
    return "monitor"
  }
  return null
}

export const getPreviousStep = (
  step: DeployStep,
  state: {
    source: { sourceType: DeploySourceType }
  }
): DeployStep | null => {
  const { sourceType } = state.source
  if (sourceType === "template") {
    if (step === "monitor") return "environment"
    if (step === "environment") return "source"
    return null
  }

  // For GitHub source:
  if (step === "monitor") return "environment"
  if (step === "environment") return "build" // Always allow going back to build to view/override
  if (step === "build") return "source"
  return null
}

export const isStepValid = (
  step: Exclude<DeployStep, "monitor">,
  state: DeployWizardState
): boolean => {
  if (step === "source") {
    return validateSourceStep(state.source)
  }

  if (step === "build") {
    return validateBuildStep(state.build, state.detectionResult)
  }

  return validateEnvironmentStep(state.environment)
}

export const getMaxUnlockedStep = (state: DeployWizardState): DeployStep => {
  if (!isStepValid("source", state)) {
    return "source"
  }

  if (state.source.sourceType !== "template") {
    if (!isStepValid("build", state)) {
      return "build"
    }
  }

  if (!isStepValid("environment", state)) {
    return "environment"
  }

  return "monitor"
}

export const clampStepToUnlocked = (
  requestedStep: DeployStep,
  state: DeployWizardState
): DeployStep => {
  const maxUnlocked = getMaxUnlockedStep(state)
  const stepsOrder = getAvailableStepsList(state.source.sourceType)
  const requestedIndex = stepsOrder.indexOf(requestedStep)
  const maxUnlockedIndex = stepsOrder.indexOf(maxUnlocked)

  if (requestedIndex <= maxUnlockedIndex) {
    return requestedStep
  }

  return maxUnlocked
}

export const resolveMonitorStatus = (
  tick: number,
  shouldFail: boolean
): DeployStatus => {
  if (tick <= 0) {
    return "queued"
  }

  if (tick === 1 || tick === 2) {
    return "building"
  }

  if (tick === 3) {
    return "deploying"
  }

  return shouldFail ? "failed" : "running"
}
