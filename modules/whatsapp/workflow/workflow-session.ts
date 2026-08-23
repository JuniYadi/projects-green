import { redis } from "@/lib/redis"
import type { WorkflowSessionState } from "./workflow.schema"

export type TemplateContext = {
  variables: Record<string, unknown>
  steps: Record<string, unknown>
  session: Record<string, unknown>
}

/**
 * Resolves a dotted path (e.g. "variables.name" or "steps.http_1.body.id") from an object.
 */
function resolveNestedPath(
  obj: Record<string, unknown>,
  path: string
): unknown {
  const parts = path.split(".")
  let current: unknown = obj

  for (const part of parts) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== "object"
    ) {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }

  return current
}

/**
 * Evaluates template syntax `{{path}}` against context variables, step outputs, and session.
 */
export function evaluateMustacheTemplate(
  template: string,
  context: TemplateContext
): string {
  if (!template || !template.includes("{{")) {
    return template
  }

  return template.replace(
    /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g,
    (_match, path: string) => {
      const val = resolveNestedPath(context as Record<string, unknown>, path)
      if (val === undefined || val === null) {
        return ""
      }
      if (typeof val === "object") {
        return JSON.stringify(val)
      }
      return String(val)
    }
  )
}

// ─── Redis Session Store & Mutex ──────────────────────────────────────────────

const SESSION_TTL_SECONDS = 1800 // 30 minutes
const MUTEX_TTL_SECONDS = 5 // 5 seconds lock

export class WorkflowSessionStore {
  private readonly redisClient = redis

  /**
   * Attempts to acquire an atomic distributed lock for a phone session.
   * Returns a unique lock token on success, or null if lock is already held.
   */
  async acquireLock(orgId: string, phone: string): Promise<string | null> {
    const key = `wa_wf_lock:${orgId}:${phone}`
    const token = crypto.randomUUID()
    const acquired = await this.redisClient.set(
      key,
      token,
      "EX",
      MUTEX_TTL_SECONDS,
      "NX"
    )
    return acquired === "OK" ? token : null
  }

  /**
   * Releases distributed lock atomically using Lua script to verify ownership.
   */
  async releaseLock(
    orgId: string,
    phone: string,
    token: string
  ): Promise<void> {
    const key = `wa_wf_lock:${orgId}:${phone}`
    if (typeof this.redisClient.eval === "function") {
      const script = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`
      await this.redisClient.eval(script, 1, key, token)
    } else {
      const current = await this.redisClient.get(key)
      if (current === token) {
        await this.redisClient.del(key)
      }
    }
  }
  /**
   * Retrieves active workflow session state.
   */
  async getSession(
    orgId: string,
    phone: string
  ): Promise<WorkflowSessionState | null> {
    const key = `wa_wf_session:${orgId}:${phone}`
    const raw = await this.redisClient.get(key)
    if (!raw) return null

    try {
      return JSON.parse(raw) as WorkflowSessionState
    } catch {
      return null
    }
  }

  /**
   * Saves or updates workflow session state.
   */
  async saveSession(state: WorkflowSessionState): Promise<void> {
    const key = `wa_wf_session:${state.organizationId}:${state.phoneNumber}`
    await this.redisClient.set(
      key,
      JSON.stringify(state),
      "EX",
      SESSION_TTL_SECONDS
    )
  }

  /**
   * Clears active workflow session state.
   */
  async clearSession(orgId: string, phone: string): Promise<void> {
    const key = `wa_wf_session:${orgId}:${phone}`
    await this.redisClient.del(key)
  }
}

export const workflowSessionStore = new WorkflowSessionStore()
