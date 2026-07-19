import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import { recordDeployEvent, recordDeployLog } from "../../deploy-event.service"

/**
 * POST /api/deploy/jenkins-webhook
 *
 * Receives build result callbacks from Jenkins.
 * Body: { slug: string, buildStatus: "SUCCESS"|"FAILURE", commitSha?: string }
 */
export const deployJenkinsWebhookRoutes = new Elysia({
  prefix: "/deploy",
}).post(
  "/jenkins-webhook",
  async ({ body, set }) => {
    const token = process.env.JENKINS_WEBHOOK_TOKEN
    // ponytail: simple token check; add HMAC if needed later
    if (token && body.token !== token) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED" }
    }

    const { slug, buildStatus, commitSha } = body

    const stack = await prisma.applicationStack.findFirst({
      where: { slug },
    })

    if (!stack) {
      set.status = 404
      return {
        ok: false,
        error: "NOT_FOUND",
        message: `Stack ${slug} not found`,
      }
    }

    // Find the latest active deployment for this stack
    const deployment = await prisma.applicationDeployment.findFirst({
      where: {
        stackId: stack.id,
        status: { in: ["QUEUED", "BUILDING"] },
        ...(commitSha ? { commitSha } : {}),
      },
      orderBy: { createdAt: "desc" },
    })

    if (!deployment) {
      return { ok: true, message: "No active deployment to update" }
    }

    // Idempotency check — skip if already processed
    if (deployment.status === "RUNNING") {
      return { ok: true, message: "Deployment already completed" }
    }

    if (buildStatus === "SUCCESS") {
      // Only update status - do NOT call processQueuedDeployment
      await prisma.applicationDeployment.update({
        where: { id: deployment.id },
        data: { status: "RUNNING" },
      })
      await recordDeployEvent({
        deploymentId: deployment.id,
        type: "DEPLOY_COMPLETED",
        message: `Jenkins build succeeded for ${slug}`,
      })
      await recordDeployLog({
        deploymentId: deployment.id,
        scope: "build",
        status: "BUILD_SUCCESS",
        message: "Jenkins build completed successfully.",
      })
    } else {
      const attempt = deployment.attempt ?? 1
      if (attempt < 3) {
        // Retry: re-queue with incremented attempt
        const newAttempt = attempt + 1
        await prisma.applicationDeployment.update({
          where: { id: deployment.id },
          data: {
            status: "QUEUED",
            attempt: newAttempt,
          },
        })
        await recordDeployLog({
          deploymentId: deployment.id,
          scope: "build",
          status: "RETRYING",
          message: `Build failed (attempt ${attempt}/3), re-queued for retry.`,
        })
      } else {
        // Max retries exhausted
        await prisma.applicationDeployment.update({
          where: { id: deployment.id },
          data: {
            status: "FAILED",
            failureReason: `Jenkins build failed after ${attempt} attempts`,
            completedAt: new Date(),
          },
        })
        await prisma.applicationStack.update({
          where: { id: stack.id },
          data: { lastDeployStatus: "FAILED" },
        })
        await recordDeployEvent({
          deploymentId: deployment.id,
          type: "DEPLOY_FAILED",
          message: `Build failed after ${attempt} attempts`,
        })
        await recordDeployLog({
          deploymentId: deployment.id,
          scope: "build",
          status: "FAILED",
          message: `Jenkins build failed after ${attempt} attempts.`,
        })
      }
    }

    return { ok: true }
  },
  {
    body: t.Object({
      slug: t.String(),
      buildStatus: t.Union([t.Literal("SUCCESS"), t.Literal("FAILURE")]),
      commitSha: t.Optional(t.String()),
      token: t.Optional(t.String()),
    }),
  }
)
