import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import { resolveClusterIntegration } from "../../cluster-integration.service"
import { handleJenkinsImageReady } from "../../jenkins-image-ready.service"
import { verifyJenkinsHmacSignature } from "../../jenkins-webhook-auth"

/**
 * POST /api/deploy/jenkins-image-ready
 *
 * Receives the image tag Jenkins just pushed. Authenticated via the cluster
 * JENKINS.webhookToken (or env fallback) using HMAC-SHA256 signature verification.
 * On success commits a Helm value.yml for the stack and records the
 * IMAGE_TAG_RECEIVED, GITOPS_COMMIT_CREATED, MANIFEST_PUSHED, and
 * ARGOCD_SYNC_STARTED events.
 */
export const deployJenkinsImageReadyRoutes = new Elysia({
  prefix: "/deploy",
})
  .onParse(async ({ request }, contentType) => {
    if (contentType.includes("application/json")) {
      const text = await request.text()
      try {
        const parsed = JSON.parse(text)
        if (parsed && typeof parsed === "object") {
          return Object.assign(parsed, { __rawBody: text })
        }
      } catch {}
      return text
    }
  })
  .post(
    "/jenkins-image-ready",
    async ({ body, request, set }) => {
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

      if (!expectedToken) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED" }
      }

      const rawBody = (body as any)?.__rawBody || JSON.stringify(body)

      const isValid = verifyJenkinsHmacSignature(
        rawBody,
        request.headers,
        expectedToken
      )

      if (!isValid) {
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
        ...(body.digest !== undefined ? { digest: body.digest } : {}),
        ...(body.sizeBytes !== undefined ? { sizeBytes: body.sizeBytes } : {}),
      })

      return result
    },
    {
      body: t.Object(
        {
          slug: t.String(),
          imageTag: t.String(),
          token: t.Optional(t.String()),
          deploymentId: t.Optional(t.String()),
          commitSha: t.Optional(t.String()),
          buildNumber: t.Optional(t.Number()),
          digest: t.Optional(t.String()),
          sizeBytes: t.Optional(t.Union([t.Number(), t.String()])),
          __rawBody: t.Optional(t.String()),
        },
        { additionalProperties: true }
      ),
    }
  )
