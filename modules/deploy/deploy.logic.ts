import {
  validateBuildStep,
  validateEnvironmentStep,
  validateSourceStep,
} from "@/modules/deploy/deploy.schema"
import type {
  DeployStatus,
  DeployStep,
  DeployWizardState,
} from "@/modules/deploy/deploy.types"

export const getAvailableStepsList = (): DeployStep[] => {
  return ["source", "connect", "detect", "review", "deploy"]
}

export const getStepIndex = (step: DeployStep): number => {
  return getAvailableStepsList().indexOf(step)
}

export const getNextStep = (step: DeployStep): DeployStep | null => {
  if (step === "source") return "connect"
  if (step === "connect") return "detect"
  if (step === "detect") return "review"
  if (step === "review") return "deploy"
  return null
}

export const getPreviousStep = (step: DeployStep): DeployStep | null => {
  if (step === "connect") return "source"
  if (step === "detect") return "connect"
  if (step === "review") return "detect"
  if (step === "deploy") return "review"
  return null
}

export const isStepValid = (
  step: Exclude<DeployStep, "deploy">,
  state: DeployWizardState
): boolean => {
  if (step === "source" || step === "connect") {
    return validateSourceStep(state.source)
  }

  if (step === "detect") {
    return validateBuildStep(state.build, state.detectionResult)
  }

  return validateEnvironmentStep(state.environment)
}

export const getMaxUnlockedStep = (state: DeployWizardState): DeployStep => {
  if (!isStepValid("source", state)) {
    return "source"
  }

  if (!state.detectionResult) {
    return "detect"
  }

  if (!isStepValid("detect", state)) {
    return "detect"
  }

  if (!isStepValid("review", state)) {
    return "review"
  }

  return state.monitor.deployId && state.monitor.status !== "idle"
    ? "deploy"
    : "review"
}

export const clampStepToUnlocked = (
  requestedStep: DeployStep,
  state: DeployWizardState
): DeployStep => {
  const maxUnlocked = getMaxUnlockedStep(state)
  const requestedIndex = getStepIndex(requestedStep)
  const maxUnlockedIndex = getStepIndex(maxUnlocked)

  return requestedIndex <= maxUnlockedIndex ? requestedStep : maxUnlocked
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
