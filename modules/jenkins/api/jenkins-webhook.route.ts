import { Elysia, t } from "elysia"
import { jenkinsWebhookHandler } from "./jenkins-webhook.handler"

export const jenkinsWebhookRoutes = new Elysia({ prefix: "/webhooks/jenkins" })
  .post(
    "/version-update",
    async ({ body, headers, set }) => {
      const token = headers["x-jenkins-token"]
      
      if (!await jenkinsWebhookHandler.verifyToken(token || null)) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Invalid or missing X-Jenkins-Token" }
      }

      const { version, application_stack } = body
      
      const stack = await jenkinsWebhookHandler.resolveApplicationStack(application_stack)
      
      if (!stack) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: `Application stack '${application_stack}' not found` }
      }

      try {
        const result = await jenkinsWebhookHandler.syncVersion(stack, version)
        return { success: true, version: result.version }
      } catch (error) {
        console.error("Jenkins webhook sync failed:", error)
        set.status = 500
        return { ok: false, error: "SYNC_FAILED", message: error instanceof Error ? error.message : "Unknown error" }
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
