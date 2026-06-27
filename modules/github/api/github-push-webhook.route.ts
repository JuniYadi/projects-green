import { Hono } from "hono"
import {
  verifyGitHubSignature,
  parsePushPayload,
} from "../github-push-dispatcher"

const app = new Hono()

app.post("/push", async (c) => {
  const signature = c.req.header("x-hub-signature-256")
  const body = await c.req.text()

  // In a real app, secret would come from environment or DB per repository
  const secret = process.env.GITHUB_WEBHOOK_SECRET || "development-secret"

  if (!signature || !verifyGitHubSignature(body, signature, secret)) {
    return c.json({ error: "Invalid signature" }, 401)
  }

  const payload = parsePushPayload(JSON.parse(body))

  if (payload.deleted) {
    return c.json({ message: "Branch deleted, skipping" }, 200)
  }

  // NOTE: This Hono route is deprecated — push events are handled via
  // the Elysia webhook route at POST /api/integrations/github/webhook.
  // This route is kept only for backward compat with older webhook configs.
  return c.json({ message: "Use the Elysia webhook endpoint instead" }, 200)
})

export default app
