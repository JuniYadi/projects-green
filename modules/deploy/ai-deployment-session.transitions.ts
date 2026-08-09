import type { AiDeploymentSessionStatus } from "@prisma/client"

export type Transition = [AiDeploymentSessionStatus, AiDeploymentSessionStatus]

const TRANSITIONS: ReadonlySet<string> = new Set([
  // collecting
  "COLLECTING→INSPECTING",
  "COLLECTING→BLOCKED",
  // inspecting
  "INSPECTING→PLAN_READY",
  "INSPECTING→BLOCKED",
  "INSPECTING→FAILED",
  // blocked
  "BLOCKED→COLLECTING",
  "BLOCKED→INSPECTING",
  // plan_ready
  "PLAN_READY→COLLECTING",
  "PLAN_READY→CONFIRMED",
  // confirmed
  "CONFIRMED→EXECUTING",
  // executing
  "EXECUTING→SUCCEEDED",
  "EXECUTING→FAILED",
  // failed (retry)
  "FAILED→COLLECTING",
  "FAILED→PLAN_READY",
])

const TERMINAL: ReadonlySet<AiDeploymentSessionStatus> = new Set([
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
])

const NON_TERMINAL: AiDeploymentSessionStatus[] = [
  "COLLECTING",
  "INSPECTING",
  "BLOCKED",
  "PLAN_READY",
  "CONFIRMED",
  "EXECUTING",
]

export function isValidTransition(
  from: AiDeploymentSessionStatus,
  to: AiDeploymentSessionStatus
): boolean {
  if (from === to) return false
  if (to === "CANCELLED") return !isTerminal(from)
  return TRANSITIONS.has(`${from}→${to}`)
}

export function isTerminal(status: AiDeploymentSessionStatus): boolean {
  return TERMINAL.has(status)
}

export function canConfirm(status: AiDeploymentSessionStatus): boolean {
  return status === "PLAN_READY"
}

export function canExecute(status: AiDeploymentSessionStatus): boolean {
  return status === "CONFIRMED"
}

export { NON_TERMINAL }
