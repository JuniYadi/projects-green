import type {
  DeployBuildState,
  DeployEnvironmentState,
  DeployMonitorState,
  DeploySourceState,
  DeployStatus,
  DeployStep,
} from "@/modules/deploy/deploy.types"

export const DEPLOY_STEPS: Array<{
  id: DeployStep
  label: string
  description: string
}> = [
  {
    id: "source",
    label: "Source",
    description: "Where is your code?",
  },
  {
    id: "build",
    label: "Build",
    description: "How do we build it?",
  },
  {
    id: "environment",
    label: "Environment",
    description: "Where does it run?",
  },
  {
    id: "monitor",
    label: "Monitor",
    description: "Watch it go live",
  },
]

export const DEPLOY_STEP_ORDER = DEPLOY_STEPS.map((step) => step.id)

export const DEPLOY_STEP_QUERY_KEY = "step"

export const HIGH_CONFIDENCE_THRESHOLD = 80
export const LOW_CONFIDENCE_THRESHOLD = 50

export const DEPLOY_WIZARD_STORAGE_VERSION = 1
export const DEPLOY_WIZARD_STORAGE_KEY =
  "pfnapp.console.deploy-wizard.v1"

export const DEFAULT_SOURCE_STATE: DeploySourceState = {
  ownerId: "",
  repositoryId: "",
  branchName: "",
  rootDirectory: "/",
}

export const DEFAULT_BUILD_STATE: DeployBuildState = {
  language: "",
  framework: "",
  buildCommand: "",
  useDockerfile: false,
}

export const DEFAULT_ENVIRONMENT_STATE: DeployEnvironmentState = {
  useGeneratedSubdomain: true,
  customDomain: "",
  envVars: [],
  resourcePlanId: "starter",
}

export const DEFAULT_MONITOR_STATE: DeployMonitorState = {
  status: "idle",
  logScope: "all",
  attempt: 0,
  tick: 0,
  isActive: false,
  shouldFail: false,
  failureReason: null,
}

export const DEPLOY_STATUS_LABELS: Record<DeployStatus, string> = {
  idle: "Not started",
  queued: "Queued",
  building: "Building",
  deploying: "Deploying",
  running: "Running",
  failed: "Failed",
}

export const MONITOR_POLL_INTERVAL_MS = 900

export const MANUAL_LANGUAGE_OPTIONS = [
  "Node.js",
  "Python",
  "Go",
  "PHP",
  "Ruby",
] as const

export const MANUAL_FRAMEWORK_OPTIONS = [
  "Next.js",
  "React",
  "Express",
  "Django",
  "FastAPI",
  "Gin",
  "Laravel",
  "Rails",
] as const

export const parseStepQueryValue = (
  value: string | null | undefined
): DeployStep => {
  if (!value) {
    return "source"
  }

  const matched = DEPLOY_STEP_ORDER.find((step) => step === value)
  return matched ?? "source"
}
