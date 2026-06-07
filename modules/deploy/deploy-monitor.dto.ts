import type {
  Deployment,
  DeployEvent,
  DeploymentLog,
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

const normalizeLogScope = (
  scope: string
): Exclude<DeployLogScope, "all"> => {
  return scope === "build" ? "build" : "runtime"
}

const normalizeLogStatus = (
  status: string
): Exclude<DeployStatus, "idle"> => {
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
    { id: "prep", label: "Preparing", status: "queued" },
    { id: "build", label: "Building", status: "building" },
    { id: "deploy", label: "Deploying", status: "deploying" },
  ]
}

/**
 * Map a persisted deployment into the status DTO consumed by the
 * monitor/manage status panels.
 */
export const toDeploymentStatusDTO = (
  deployment: Pick<
    Deployment,
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
  logs: Array<Pick<DeploymentLog, "id" | "scope" | "status" | "message">>
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
const DEPLOY_EVENT_LABELS: Record<string, string> = {
  QUEUED: "Queued",
  BUILD_STARTED: "Build started",
  MANIFEST_PUSHED: "Manifest pushed",
  ARGOCD_SYNC_STARTED: "Sync started",
  ARGOCD_SYNCED: "Synced",
  DEPLOY_COMPLETED: "Deploy completed",
  DEPLOY_FAILED: "Deploy failed",
  ROLLBACK_STARTED: "Rollback started",
  ROLLBACK_COMPLETED: "Rollback completed",
}

export type DeployEventDTO = {
  id: string
  type: string
  label: string
  message: string | null
  createdAt: string
}

export const toDeployEventDTOs = (
  events: Array<Pick<DeployEvent, "id" | "type" | "message" | "createdAt">>
): DeployEventDTO[] => {
  return events.map((event) => ({
    id: event.id,
    type: event.type,
    label: DEPLOY_EVENT_LABELS[event.type] ?? event.type,
    message: event.message ?? null,
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
  lastDeployedAt: string | null
  latestDeploymentId: string | null
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
  lastDeployedAt: Date | null
  deployments?: Array<{ id: string }>
}): StackSummaryDTO => {
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
    lastDeployedAt: stack.lastDeployedAt
      ? stack.lastDeployedAt.toISOString()
      : null,
    latestDeploymentId: stack.deployments?.[0]?.id ?? null,
  }
}
