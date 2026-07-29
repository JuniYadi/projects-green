import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import { resolveClusterIntegration } from "../../cluster-integration.service"
import { handleJenkinsImageReady } from "../../jenkins-image-ready.service"

/**
 * POST /api/deploy/jenkins-image-ready
 *
 * Receives the image tag Jenkins just pushed. Authenticated via the cluster
 * JENKINS.webhookToken (or env fallback). On success commits a Helm value.yml
 * for the stack and records the IMAGE_TAG_RECEIVED, GITOPS_COMMIT_CREATED,
 * MANIFEST_PUSHED, and ARGOCD_SYNC_STARTED events.
 */
export const deployJenkinsImageReadyRoutes = new Elysia({
  prefix: "/deploy",
}).post(
  "/jenkins-image-ready",
  async ({ body, set }) => {
    const envToken = process.env.JENKINS_WEBHOOK_TOKEN

    const stack = await prisma.applicationStack.findFirst({
      where: { slug: body.slug },
    })

    let expectedToken: string | null = envToken ?? null
    if (stack) {
      try {
        const jenkinsConfig = await resolveClusterIntegration(
          stack.id,
          "JENKINS"
        )
        expectedToken = jenkinsConfig.webhookToken
      } catch {
        expectedToken = envToken ?? null
      }
    }

    if (expectedToken && body.token !== expectedToken) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED" }
    }

    const result = await handleJenkinsImageReady({
      slug: body.slug,
      imageTag: body.imageTag,
      ...(body.deploymentId !== undefined
        ? { deploymentId: body.deploymentId }
        : {}),
      ...(body.commitSha !== undefined ? { commitSha: body.commitSha } : {}),
      ...(body.buildNumber !== undefined
        ? { buildNumber: body.buildNumber }
        : {}),
    })

    return result
  },
  {
    body: t.Object({
      slug: t.String(),
      imageTag: t.String(),
      deploymentId: t.Optional(t.String()),
      commitSha: t.Optional(t.String()),
      buildNumber: t.Optional(t.Number()),
      token: t.String(),
    }),
  }
)
