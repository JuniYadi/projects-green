import { Elysia, t } from "elysia"
import { jenkinsWebhookHandler } from "../jenkins-webhook.handler"

// In-memory idempotency store (5-minute window)
const IDEMPOTENCY_WINDOW_MS = 300_000
const idempotencyStore = new Map<string, number>()

// Periodic cleanup to prevent memory leak
let lastCleanup = Date.now()
const CLEANUP_INTERVAL_MS = 60_000

function isDuplicate(payloadHash: string): boolean {
  const now = Date.now()

  // Periodic cleanup
  if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
    lastCleanup = now
    for (const [key, ts] of idempotencyStore) {
      if (now - ts > IDEMPOTENCY_WINDOW_MS) {
        idempotencyStore.delete(key)
      }
    }
  }

  if (idempotencyStore.has(payloadHash)) {
    return true
  }

  idempotencyStore.set(payloadHash, now)
  return false
}

function computePayloadHash(appStack: string, ver: string): string {
  // Simple hash for idempotency key
  let hash = 0
  const str = `${appStack}:${ver}`
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0 // Convert to 32-bit integer
  }
  return `jenkins:webhook:${hash}`
}

export const jenkinsWebhookRoutes = new Elysia({ prefix: "/webhooks/jenkins" })
  .post(
    "/version-update",
    async ({ body, headers, set }) => {
      if (!body || typeof body !== "object") {
        set.status = 400
        return {
          ok: false,
          error: "INVALID_BODY",
          message: "Request body is required",
        }
      }

      const token = headers["x-jenkins-token"]

      if (!(await jenkinsWebhookHandler.verifyToken(token || null))) {
        set.status = 401
        return {
          ok: false,
          error: "UNAUTHORIZED",
          message: "Invalid or missing X-Jenkins-Token",
        }
      }

      const { version, application_stack } = body as {
        version: string
        application_stack: string
      }

      // Idempotency check — ignore duplicate webhooks within 5 minutes
      const payloadHash = computePayloadHash(application_stack, version)
      if (isDuplicate(payloadHash)) {
        return {
          success: true,
          duplicate: true,
          message: "Duplicate webhook ignored",
        }
      }

      const stack =
        await jenkinsWebhookHandler.resolveApplicationStack(application_stack)

      if (!stack) {
        set.status = 404
        return {
          ok: false,
          error: "NOT_FOUND",
          message: `Application stack '${application_stack}' not found`,
        }
      }

      try {
        const result = await jenkinsWebhookHandler.syncVersion(stack, version)
        return { success: true, version: result.version }
      } catch (error) {
        console.error("Jenkins webhook sync failed:", error)
        set.status = 500
        return {
          ok: false,
          error: "SYNC_FAILED",
          message:
            error instanceof Error ? error.message : "Unknown error",
        }
      }
    },
    {
      body: t.Object({
        version: t.String(),
        application_stack: t.String(),
      }),
    }
  )
  .get("/status", async () => {
    return await jenkinsWebhookHandler.getWebhookStatus()
  })
