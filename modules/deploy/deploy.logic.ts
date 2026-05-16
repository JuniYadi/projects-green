import { DEPLOY_STEP_ORDER } from "@/modules/deploy/deploy.constants"
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

export const getStepIndex = (step: DeployStep): number => {
  return DEPLOY_STEP_ORDER.findIndex((item) => item === step)
}

export const getNextStep = (step: DeployStep): DeployStep | null => {
  const index = getStepIndex(step)
  const next = DEPLOY_STEP_ORDER[index + 1]
  return next ?? null
}

export const getPreviousStep = (step: DeployStep): DeployStep | null => {
  const index = getStepIndex(step)
  const previous = DEPLOY_STEP_ORDER[index - 1]
  return previous ?? null
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

  if (!isStepValid("build", state)) {
    return "build"
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
  const requestedIndex = getStepIndex(requestedStep)
  const maxUnlockedIndex = getStepIndex(maxUnlocked)

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
