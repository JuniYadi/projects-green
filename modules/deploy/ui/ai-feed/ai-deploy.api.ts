/**
 * API helpers for the AI Deploy Feed UI.
 * All calls go through native fetch (not eden) to keep this self-contained.
 */

import type {
  AiDeploymentSessionDTO,
  AiInspectionDTO,
  ManualBuildSettings,
  ResourceSelection,
} from "./ai-deploy.types"

const base = () => (typeof window !== "undefined" ? window.location.origin : "")

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${base()}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(text || `Request failed: ${res.status}`)
  }
  const json = (await res.json()) as { ok: boolean; data: T; error?: string }
  if (!json.ok) throw new Error(json.error ?? "Unknown error")
  return json.data
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${base()}/api${path}`)
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(text || `Request failed: ${res.status}`)
  }
  const json = (await res.json()) as { ok: boolean; data: T; error?: string }
  if (!json.ok) throw new Error(json.error ?? "Unknown error")
  return json.data
}

// ─── Inspection ───────────────────────────────────────────────────────────────

export async function inspectSource(
  sourceUrl: string,
  opts?: { ref?: string; subdir?: string; sessionId?: string }
): Promise<AiInspectionDTO> {
  return post("/deploy/ai-sessions/inspect", {
    sourceUrl,
    ref: opts?.ref,
    subdir: opts?.subdir,
    sessionId: opts?.sessionId,
  })
}

// ─── Session ──────────────────────────────────────────────────────────────────

export async function getSession(
  sessionId: string
): Promise<AiDeploymentSessionDTO> {
  return get(`/deploy/ai-sessions/${sessionId}`)
}

export async function applyManualSettings(
  sessionId: string,
  settings: ManualBuildSettings
): Promise<AiDeploymentSessionDTO> {
  return post(`/deploy/ai-sessions/${sessionId}/manual-settings`, settings)
}

export async function setEnvValues(
  sessionId: string,
  values: { key: string; value: string }[]
): Promise<AiDeploymentSessionDTO> {
  return post(`/deploy/ai-sessions/${sessionId}/environment-values`, { values })
}

export async function selectResource(
  sessionId: string,
  selection: ResourceSelection
): Promise<AiDeploymentSessionDTO> {
  return post(`/deploy/ai-sessions/${sessionId}/resource-selection`, selection)
}

export async function confirmDeploy(
  sessionId: string,
  planVersion: number,
  planHash: string,
  idempotencyKey: string
): Promise<AiDeploymentSessionDTO> {
  return post(`/deploy/ai-sessions/${sessionId}/confirm`, {
    planVersion,
    planHash,
    idempotencyKey,
  })
}

// ─── Deployment monitoring (reuses existing route) ────────────────────────────

export type DeploymentStatusDTO = {
  status: string
  manifestPushed: boolean
  argocdSynced: boolean
  failureReason: string | null
  attempt: number
}

export async function getDeploymentStatus(
  deployId: string
): Promise<DeploymentStatusDTO> {
  return get(`/deploy/status/${deployId}`)
}

// ─── GitHub install URL ───────────────────────────────────────────────────────

export function getGithubInstallUrl(): string {
  return `${base()}/api/integrations/github/install/start`
}
