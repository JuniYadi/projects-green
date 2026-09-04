import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import {
  recordDeployEventOnce,
  recordDeployLog,
} from "../../deploy-event.service"

/**
 * POST /api/deploy/jenkins-webhook
 *
 * Receives build status callbacks from Jenkins. Body shape supports the
 * new build-phase events (JENKINS_BUILD_QUEUED / RUNNING / COMPLETED) so
 * the UI timeline can render real Jenkins progress. The image tag itself
 * is delivered via /api/deploy/jenkins-image-ready — this route is for
 * build status and failure notifications.
 */
export const deployJenkinsWebhookRoutes = new Elysia({
  prefix: "/deploy",
}).post(
  "/jenkins-webhook",
  async ({ body, set }) => {
    const token = process.env.JENKINS_WEBHOOK_TOKEN
    // ponytail: simple token check; add HMAC if needed later
    if (!token || body.token !== token) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED" }
    }

    const {
      slug,
      buildStatus,
      commitSha,
      buildNumber,
      durationMs,
      imageTag,
      phase,
    } = body

    if (phase) {
      const stack = await prisma.applicationStack.findFirst({
        where: { slug },
      })
      if (stack) {
        const deployment = await prisma.applicationDeployment.findFirst({
          where: {
            stackId: stack.id,
            status: { in: ["QUEUED", "BUILDING", "DEPLOYING"] },
            ...(commitSha ? { commitSha } : {}),
          },
          orderBy: { createdAt: "desc" },
        })

        if (deployment) {
          if (phase === "QUEUED") {
            await recordDeployEventOnce({
              deploymentId: deployment.id,
              type: "JENKINS_BUILD_QUEUED",
              message: `Jenkins build queued for ${slug}`,
              metadata: buildNumber !== undefined ? { buildNumber } : {},
            })
          } else if (phase === "RUNNING") {
            if (deployment.status === "QUEUED") {
              await prisma.applicationDeployment.update({
                where: { id: deployment.id },
                data: { status: "BUILDING" },
              })
            }
            await recordDeployEventOnce({
              deploymentId: deployment.id,
              type: "JENKINS_BUILD_RUNNING",
              message: `Jenkins build running for ${slug}`,
              metadata: buildNumber !== undefined ? { buildNumber } : {},
            })
          } else if (phase === "COMPLETED") {
            await recordDeployEventOnce({
              deploymentId: deployment.id,
              type: "JENKINS_BUILD_COMPLETED",
              message: `Jenkins build completed for ${slug}`,
              metadata: {
                ...(buildNumber !== undefined ? { buildNumber } : {}),
                ...(durationMs !== undefined ? { durationMs } : {}),
                imageTag: imageTag ?? null,
                commitSha: commitSha ?? null,
              },
            })
          }
        }
      }
      return { ok: true, message: `Recorded phase ${phase}` }
    }

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
        status: { in: ["QUEUED", "BUILDING", "DEPLOYING"] },
        ...(commitSha ? { commitSha } : {}),
      },
      orderBy: { createdAt: "desc" },
    })

    if (!deployment) {
      return { ok: true, message: "No active deployment to update" }
    }

    // Idempotency check — skip if already completed successfully
    if (deployment.status === "RUNNING") {
      return { ok: true, message: "Deployment already completed" }
    }

    if (buildStatus === "SUCCESS") {
      // Do NOT mark RUNNING here. ArgoCD owns the RUNNING transition after
      // the image-ready webhook commits Helm values and sync completes.
      await recordDeployEventOnce({
        deploymentId: deployment.id,
        type: "JENKINS_BUILD_COMPLETED",
        message: `Jenkins build succeeded for ${slug}`,
        metadata: {
          ...(buildNumber !== undefined ? { buildNumber } : {}),
          ...(durationMs !== undefined ? { durationMs } : {}),
          imageTag: imageTag ?? null,
          commitSha: commitSha ?? null,
        },
      })
      await recordDeployLog({
        deploymentId: deployment.id,
        scope: "build",
        status: "BUILD_SUCCESS",
        message:
          "Jenkins build completed successfully. Awaiting image-ready webhook.",
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
        await recordDeployEventOnce({
          deploymentId: deployment.id,
          type: "JENKINS_BUILD_COMPLETED",
          message: `Jenkins build failed for ${slug} (attempt ${attempt}/3)`,
          metadata: {
            ...(buildNumber !== undefined ? { buildNumber } : {}),
            commitSha: commitSha ?? null,
            outcome: "FAILURE",
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
        await recordDeployEventOnce({
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
      buildStatus: t.Optional(
        t.Union([t.Literal("SUCCESS"), t.Literal("FAILURE")])
      ),
      commitSha: t.Optional(t.String()),
      buildNumber: t.Optional(t.Number()),
      durationMs: t.Optional(t.Number()),
      imageTag: t.Optional(t.String()),
      phase: t.Optional(
        t.Union([
          t.Literal("QUEUED"),
          t.Literal("RUNNING"),
          t.Literal("COMPLETED"),
        ])
      ),
      token: t.Optional(t.String()),
    }),
  }
)
