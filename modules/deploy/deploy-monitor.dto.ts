import type {
  ApplicationDeployment,
  ApplicationDeployEvent,
  ApplicationDeploymentLog,
  StackStatus,
} from "@prisma/client"

import type {
  DeployLogLine,
  DeployLogScope,
  DeployStatus,
  DeployTimelineItem,
} from "@/modules/deploy/deploy.types"
/**
 * PGREEN-072 — Console Monitor/Manage truth path.
 *
 * Boundary DTO mappers that translate persisted deployment state
 * (Prisma models) into the shapes the monitor/manage UI consumes.
 * Keeping these pure makes the "real backend state" contract testable
 * and prevents the UI from re-deriving status from simulated data.
 */

export type DeploymentStatusDTO = {
  id: string
  status: DeployStatus
  attempt: number
  manifestPushed: boolean
  argocdSynced: boolean
  failureReason: string | null
  startedAt: string | null
  completedAt: string | null
}

/**
 * Map the persisted StackStatus to the UI DeployStatus union.
 * IDLE collapses to "idle"; everything else maps 1:1 (lowercased).
 */
export const mapStackStatusToDeployStatus = (
  status: StackStatus | string
): DeployStatus => {
  switch (status) {
    case "QUEUED":
      return "queued"
    case "BUILDING":
      return "building"
    case "DEPLOYING":
      return "deploying"
    case "RUNNING":
      return "running"
    case "FAILED":
      return "failed"
    case "IDLE":
    default:
      return "idle"
  }
}

const normalizeLogScope = (scope: string): Exclude<DeployLogScope, "all"> => {
  return scope === "build" ? "build" : "runtime"
}

const normalizeLogStatus = (status: string): Exclude<DeployStatus, "idle"> => {
  const normalized = status.toLowerCase()
  if (
    normalized === "queued" ||
    normalized === "building" ||
    normalized === "deploying" ||
    normalized === "running" ||
    normalized === "failed"
  ) {
    return normalized
  }

  // info/debug/warn log levels are not lifecycle states; surface them as
  // runtime-scoped "deploying" progress lines so they remain visible.
  return "deploying"
}

/**
 * Canonical, ordered deploy phases. The timeline component derives
 * completion from the live status, so the labels stay fixed while
 * progress reflects real backend state.
 */
export const buildDeployTimelineItems = (): DeployTimelineItem[] => {
  return [
    { id: "queued", label: "Queued", status: "queued" },
    {
      id: "monitor-wait",
      label: "Waiting in queue",
      status: "queued",
    },
    {
      id: "monitor-picked-up",
      label: "Preparing build",
      status: "building",
    },
    {
      id: "jenkins-triggered",
      label: "Build initialized",
      status: "building",
    },
    {
      id: "jenkins-queued",
      label: "Build queued",
      status: "building",
    },
    {
      id: "jenkins-running",
      label: "Building application",
      status: "building",
    },
    {
      id: "image-pushed",
      label: "Application packaged",
      status: "building",
    },
    {
      id: "image-tag-received",
      label: "Release ready",
      status: "deploying",
    },
    {
      id: "gitops-committed",
      label: "Configuration applied",
      status: "deploying",
    },
    {
      id: "argocd-sync-started",
      label: "Deploying to cloud",
      status: "deploying",
    },
    {
      id: "argocd-synced",
      label: "Deployment verified",
      status: "deploying",
    },
    { id: "pods-ready", label: "Application healthy", status: "running" },
    { id: "live", label: "Live", status: "running" },
  ]
}

/**
 * Map a persisted deployment into the status DTO consumed by the
 * monitor/manage status panels.
 */
export const toDeploymentStatusDTO = (
  deployment: Pick<
    ApplicationDeployment,
    | "id"
    | "status"
    | "attempt"
    | "manifestPushed"
    | "argocdSynced"
    | "failureReason"
    | "startedAt"
    | "completedAt"
  >
): DeploymentStatusDTO => {
  return {
    id: deployment.id,
    status: mapStackStatusToDeployStatus(deployment.status),
    attempt: Math.max(deployment.attempt, 1),
    manifestPushed: deployment.manifestPushed,
    argocdSynced: deployment.argocdSynced,
    failureReason: deployment.failureReason ?? null,
    startedAt: deployment.startedAt ? deployment.startedAt.toISOString() : null,
    completedAt: deployment.completedAt
      ? deployment.completedAt.toISOString()
      : null,
  }
}

/**
 * Map persisted deployment logs into the log-line shape the UI renders.
 * Empty input yields an empty array so the UI shows an honest no-data state.
 */
export const toDeployLogLines = (
  logs: Array<
    Pick<ApplicationDeploymentLog, "id" | "scope" | "status" | "message">
  >
): DeployLogLine[] => {
  return logs.map((log) => ({
    id: log.id,
    scope: normalizeLogScope(log.scope),
    status: normalizeLogStatus(log.status),
    message: log.message,
  }))
}

/**
 * Map persisted deploy events into labeled timeline items, preserving
 * chronological order. Used where the UI wants the real event stream
 * rather than the canonical phase scaffold.
 */
export const DEPLOY_EVENT_LABELS: Record<string, string> = {
  QUEUED: "Queued",
  BUILD_STARTED: "Build started",
  JENKINS_JOB_TRIGGERED: "Build requested",
  JENKINS_BUILD_QUEUED: "Build queued",
  JENKINS_BUILD_RUNNING: "Building application",
  JENKINS_BUILD_COMPLETED: "Build completed",
  IMAGE_TAG_RECEIVED: "Release ready",
  GITOPS_COMMIT_CREATED: "Configuration generated",
  MANIFEST_PUSHED: "Configuration applied",
  ARGOCD_SYNC_STARTED: "Deploying to cloud",
  ARGOCD_SYNCED: "Deployment verified",
  POD_READY: "Application healthy",
  DEPLOY_COMPLETED: "Application live",
  DEPLOY_FAILED: "Deploy failed",
  ROLLBACK_STARTED: "Rollback started",
  ROLLBACK_COMPLETED: "Rollback completed",
}

export const DEPLOY_EVENT_STEP_INDEX: Record<string, number> = {
  QUEUED: 0,
  BUILD_STARTED: 2,
  JENKINS_JOB_TRIGGERED: 3,
  JENKINS_BUILD_QUEUED: 4,
  JENKINS_BUILD_RUNNING: 5,
  JENKINS_BUILD_COMPLETED: 6,
  IMAGE_TAG_RECEIVED: 7,
  GITOPS_COMMIT_CREATED: 8,
  MANIFEST_PUSHED: 6,
  ARGOCD_SYNC_STARTED: 9,
  ARGOCD_SYNCED: 10,
  POD_READY: 11,
  DEPLOY_COMPLETED: 12,
}

export type CurrentDeployStepDTO = {
  currentStepLabel: string | null
  currentStepIndex: number | null
  currentStepStartedAt: string | null
}

export const deriveCurrentDeployStep = (
  events: Array<Pick<ApplicationDeployEvent, "type" | "createdAt">> = []
): CurrentDeployStepDTO => {
  const recognized = events.filter(
    (event) => DEPLOY_EVENT_STEP_INDEX[event.type] !== undefined
  )
  const latest = recognized[recognized.length - 1]
  if (!latest)
    return {
      currentStepLabel: null,
      currentStepIndex: null,
      currentStepStartedAt: null,
    }

  return {
    currentStepLabel: DEPLOY_EVENT_LABELS[latest.type] ?? latest.type,
    currentStepIndex: DEPLOY_EVENT_STEP_INDEX[latest.type] ?? null,
    currentStepStartedAt: latest.createdAt
      ? latest.createdAt.toISOString()
      : null,
  }
}

export type DeploymentHistoryDTO = {
  id: string
  status: DeployStatus
  attempt: number
  durationMs: number | null
  commitSha: string | null
  failureReason: string | null
  startedAt: string | null
  completedAt: string | null
}

export const toDeploymentHistoryDTO = (
  deployment: Pick<
    ApplicationDeployment,
    | "id"
    | "status"
    | "attempt"
    | "commitSha"
    | "failureReason"
    | "startedAt"
    | "completedAt"
  >,
  now: Date = new Date()
): DeploymentHistoryDTO => {
  const startedAt = deployment.startedAt ?? null
  const completedAt = deployment.completedAt ?? null

  return {
    id: deployment.id,
    status: mapStackStatusToDeployStatus(deployment.status),
    attempt: Math.max(deployment.attempt, 1),
    durationMs: startedAt
      ? Math.max(0, (completedAt ?? now).getTime() - startedAt.getTime())
      : null,
    commitSha: deployment.commitSha ?? null,
    failureReason: deployment.failureReason ?? null,
    startedAt: startedAt?.toISOString() ?? null,
    completedAt: completedAt?.toISOString() ?? null,
  }
}

export type DeployEventDTO = {
  id: string
  type: string
  label: string
  message: string | null
  metadataJson: unknown
  createdAt: string
}

export const toDeployEventDTOs = (
  events: Array<
    Pick<
      ApplicationDeployEvent,
      "id" | "type" | "message" | "metadataJson" | "createdAt"
    >
  >
): DeployEventDTO[] => {
  return events.map((event) => ({
    id: event.id,
    type: event.type,
    label: DEPLOY_EVENT_LABELS[event.type] ?? event.type,
    message: event.message ?? null,
    metadataJson: event.metadataJson ?? null,
    createdAt: event.createdAt.toISOString(),
  }))
}

/**
 * Stack summary DTO consumed by the manage page list/overview. It exposes
 * only the fields the MVP-critical manage surface needs and derives the
 * billing state from metadataJson (ACTIVE | PAYMENT_GRACE | SUSPENDED).
 */
export type StackBillingState = "ACTIVE" | "PAYMENT_GRACE" | "SUSPENDED"

export type StackSummaryDTO = {
  id: string
  name: string
  slug: string
  status: DeployStatus
  framework: string | null
  branchName: string
  subdomain: string | null
  customDomain: string | null
  resourcePlanId: string | null
  billingMode: string | null
  billingState: StackBillingState
  sourceType?: string | null
  templateId?: string | null
  templateName?: string | null
  port?: number | null
  cpu?: number | null
  memory?: number | null
  envCount?: number
  createdAt?: string
  orderedAt?: string
  renewalAt?: string | null
  catalogPlanName?: string | null
  catalogPlanPrice?: string | null
  catalogPlanCurrency?: string | null
  catalogBillingPeriod?: string | null
  hourlyCost?: string | null
  lastDeployedAt: string | null
  latestDeploymentId: string | null
  currentStepLabel: string | null
  currentStepIndex: number | null
  currentStepStartedAt: string | null
}

export const computeNextRenewalDate = (
  createdAt: Date | string | null | undefined
): string | null => {
  if (!createdAt) return null
  const date = new Date(createdAt)
  if (isNaN(date.getTime())) return null
  const next = new Date(date)
  next.setMonth(next.getMonth() + 1)
  return next.toISOString()
}

export const resolveStackBillingState = (
  metadataJson: unknown
): StackBillingState => {
  const meta = (metadataJson ?? {}) as Record<string, unknown>
  if (meta.billingState === "SUSPENDED") return "SUSPENDED"
  if (meta.billingState === "PAYMENT_GRACE") return "PAYMENT_GRACE"
  return "ACTIVE"
}

export const toStackSummaryDTO = (stack: {
  id: string
  name: string
  slug: string
  status: StackStatus | string
  framework: string | null
  branchName: string
  subdomain: string | null
  customDomain: string | null
  resourcePlanId: string | null
  billingMode: string | null
  metadataJson: unknown
  sourceType?: string | null
  templateId?: string | null
  template?: { name?: string | null } | null
  envVarsJson?: unknown
  cpu?: number | null
  memory?: number | null
  createdAt?: Date | null
  hourlyCost?: unknown
  catalogPlan?: {
    name: string
    code: string
    pricings?: Array<{
      periodPrice?: unknown
      currency?: string
      billingPeriod?: string
    }>
  } | null
  lastDeployedAt: Date | null
  deployments?: Array<{ id: string }>
  events?: Array<Pick<ApplicationDeployEvent, "type" | "createdAt">>
}): StackSummaryDTO => {
  const meta = (stack.metadataJson ?? {}) as Record<string, unknown>
  const envVars = Array.isArray(stack.envVarsJson)
    ? stack.envVarsJson
    : typeof stack.envVarsJson === "object" && stack.envVarsJson !== null
      ? Object.keys(stack.envVarsJson)
      : []
  const resolvedPort =
    typeof meta.port === "number"
      ? meta.port
      : typeof meta.defaultPort === "number"
        ? meta.defaultPort
        : typeof meta.servicePort === "number"
          ? meta.servicePort
          : null
  return {
    id: stack.id,
    name: stack.name,
    slug: stack.slug,
    status: mapStackStatusToDeployStatus(stack.status),
    framework: stack.framework ?? null,
    branchName: stack.branchName,
    subdomain: stack.subdomain ?? null,
    customDomain: stack.customDomain ?? null,
    resourcePlanId: stack.resourcePlanId ?? null,
    billingMode: stack.billingMode ?? null,
    billingState: resolveStackBillingState(stack.metadataJson),
    sourceType: stack.sourceType ?? null,
    templateId:
      ((stack.metadataJson as Record<string, unknown> | null)?.templateId as
        string | undefined) ??
      stack.templateId ??
      null,
    templateName:
      stack.template?.name ?? (meta.templateName as string | undefined) ?? null,
    port: resolvedPort,
    cpu: stack.cpu ?? (typeof meta.cpu === "number" ? meta.cpu : null),
    memory:
      stack.memory ?? (typeof meta.memory === "number" ? meta.memory : null),
    envCount: envVars.length,
    createdAt: stack.createdAt ? stack.createdAt.toISOString() : undefined,
    orderedAt: stack.createdAt ? stack.createdAt.toISOString() : undefined,
    renewalAt: computeNextRenewalDate(stack.createdAt),
    catalogPlanName:
      stack.catalogPlan?.name ??
      (stack.resourcePlanId
        ? `${stack.resourcePlanId.toUpperCase()} Plan`
        : null),
    catalogPlanPrice: stack.catalogPlan?.pricings?.[0]?.periodPrice
      ? String(stack.catalogPlan.pricings[0].periodPrice)
      : null,
    catalogPlanCurrency: stack.catalogPlan?.pricings?.[0]?.currency ?? "IDR",
    catalogBillingPeriod:
      stack.catalogPlan?.pricings?.[0]?.billingPeriod ?? "MONTHLY",
    hourlyCost: stack.hourlyCost != null ? String(stack.hourlyCost) : null,
    lastDeployedAt: stack.lastDeployedAt
      ? stack.lastDeployedAt.toISOString()
      : null,
    latestDeploymentId: stack.deployments?.[0]?.id ?? null,
    ...deriveCurrentDeployStep(stack.events),
  }
}
