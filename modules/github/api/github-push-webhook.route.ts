import { Hono } from "hono"
import { GithubPushEventHandler, verifyGitHubSignature, parsePushPayload } from "../github-push-dispatcher"
import { prisma } from "@/lib/prisma"

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
  const handler = new GithubPushEventHandler()
  
  // Find stacks associated with this repository
  const stacks = await prisma.stack.findMany({
    where: {
      githubRepositoryConnection: {
        fullName: payload.repository.full_name
      }
    }
  })

  if (stacks.length === 0) {
    return c.json({ message: "No stacks found for this repository" }, 200)
  }

  // Handle push for each stack
  const results = await Promise.allSettled(
    stacks.map(stack => handler.handlePush(stack as any, payload))
  )

  return c.json({ 
    message: "Processed push event",
    stacksProcessed: stacks.length,
    results: results.map(r => r.status)
  })
})

export default app
