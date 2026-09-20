import { Elysia, t } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import type { VulnerabilitySeverity } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { resolveClusterIntegration } from "../../cluster-integration.service"
import { verifyJenkinsHmacSignature } from "../../jenkins-webhook-auth"
import {
  createScanPresignedUploadUrl,
  confirmSecurityScan,
  getSecurityOverview,
  getScanFindings,
  getScanReportDownloadUrl,
} from "../../security-scan.service"
import {
  getStackContainerImages,
  validateRollbackImage,
} from "../../container-image.service"
import { rollbackDeployment } from "../../deploy-rollback.service"

export const securityScanRoutes = new Elysia({ prefix: "/deploy" })
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
  // ─── Machine Endpoints (Runner to Platform, HMAC-authenticated) ─────────────
  .post(
    "/stacks/:slug/scan-presign",
    async ({ params, body, request, set }) => {
      const stack = await prisma.applicationStack.findFirst({
        where: { slug: params.slug },
      })

      if (!stack) {
        set.status = 404
        return { ok: false, error: "STACK_NOT_FOUND" }
      }

      const envToken = process.env.JENKINS_WEBHOOK_TOKEN
      let expectedToken: string | null = envToken ?? null
      try {
        const jenkinsConfig = await resolveClusterIntegration(
          stack.id,
          "JENKINS"
        )
        expectedToken = jenkinsConfig.webhookToken
      } catch {
        expectedToken = envToken ?? null
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

      const { uploadUrl, storageKey } = await createScanPresignedUploadUrl({
        stackId: stack.id,
        imageTag: body.imageTag,
        organizationId: stack.organizationId,
      })

      return {
        ok: true,
        data: { uploadUrl, storageKey },
      }
    },
    {
      params: t.Object({ slug: t.String() }),
      body: t.Object(
        {
          imageTag: t.String(),
          token: t.Optional(t.String()),
          __rawBody: t.Optional(t.String()),
        },
        { additionalProperties: true }
      ),
    }
  )
  .post(
    "/stacks/:slug/scan-confirm",
    async ({ params, body, request, set }) => {
      const stack = await prisma.applicationStack.findFirst({
        where: { slug: params.slug },
      })

      if (!stack) {
        set.status = 404
        return { ok: false, error: "STACK_NOT_FOUND" }
      }

      const envToken = process.env.JENKINS_WEBHOOK_TOKEN
      let expectedToken: string | null = envToken ?? null
      try {
        const jenkinsConfig = await resolveClusterIntegration(
          stack.id,
          "JENKINS"
        )
        expectedToken = jenkinsConfig.webhookToken
      } catch {
        expectedToken = envToken ?? null
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

      const result = await confirmSecurityScan({
        stackId: stack.id,
        imageTag: body.imageTag,
        storageKey: body.storageKey,
        scannerEngine: body.scannerEngine,
        scannerVersion: body.scannerVersion,
        criticalCount: body.criticalCount,
        highCount: body.highCount,
        mediumCount: body.mediumCount,
        lowCount: body.lowCount,
        unfixedCount: body.unfixedCount,
        organizationId: stack.organizationId,
      })

      set.status = 202
      return {
        ok: true,
        data: result,
      }
    },
    {
      params: t.Object({ slug: t.String() }),
      body: t.Object(
        {
          imageTag: t.String(),
          storageKey: t.String(),
          scannerEngine: t.Optional(t.String()),
          scannerVersion: t.Optional(t.String()),
          criticalCount: t.Number(),
          highCount: t.Number(),
          mediumCount: t.Number(),
          lowCount: t.Number(),
          unfixedCount: t.Optional(t.Number()),
          token: t.Optional(t.String()),
          __rawBody: t.Optional(t.String()),
        },
        { additionalProperties: true }
      ),
    }
  )

  // ─── Console User Endpoints (WorkOS Session Authenticated) ─────────────────
  .get(
    "/stacks/:slug/security-overview",
    async ({ params, set }) => {
      const auth = await withAuth()
      if (!auth.user || !auth.organizationId) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED" }
      }

      const stack = await prisma.applicationStack.findFirst({
        where: { slug: params.slug, organizationId: auth.organizationId },
      })

      if (!stack) {
        set.status = 404
        return { ok: false, error: "STACK_NOT_FOUND" }
      }

      const overview = await getSecurityOverview(stack.id, auth.organizationId)
      return { ok: true, data: overview }
    },
    {
      params: t.Object({ slug: t.String() }),
    }
  )
  .get(
    "/stacks/:slug/images",
    async ({ params, set }) => {
      const auth = await withAuth()
      if (!auth.user || !auth.organizationId) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED" }
      }

      const stack = await prisma.applicationStack.findFirst({
        where: { slug: params.slug, organizationId: auth.organizationId },
      })

      if (!stack) {
        set.status = 404
        return { ok: false, error: "STACK_NOT_FOUND" }
      }

      const images = await getStackContainerImages(
        stack.id,
        auth.organizationId
      )
      return { ok: true, data: images }
    },
    {
      params: t.Object({ slug: t.String() }),
    }
  )
  .get(
    "/stacks/:slug/scans/:scanId/findings",
    async ({ params, query, set }) => {
      const auth = await withAuth()
      if (!auth.user || !auth.organizationId) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED" }
      }

      const stack = await prisma.applicationStack.findFirst({
        where: { slug: params.slug, organizationId: auth.organizationId },
      })

      if (!stack) {
        set.status = 404
        return { ok: false, error: "STACK_NOT_FOUND" }
      }

      const findings = await getScanFindings({
        scanId: params.scanId,
        organizationId: auth.organizationId,
        severity: query.severity as VulnerabilitySeverity | undefined,
        class: query.class,
        search: query.search,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      })

      return { ok: true, data: findings }
    },
    {
      params: t.Object({
        slug: t.String(),
        scanId: t.String(),
      }),
      query: t.Object({
        severity: t.Optional(t.String()),
        class: t.Optional(t.String()),
        search: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
    }
  )
  .get(
    "/stacks/:slug/scans/:scanId/download",
    async ({ params, set }) => {
      const auth = await withAuth()
      if (!auth.user || !auth.organizationId) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED" }
      }

      const stack = await prisma.applicationStack.findFirst({
        where: { slug: params.slug, organizationId: auth.organizationId },
      })

      if (!stack) {
        set.status = 404
        return { ok: false, error: "STACK_NOT_FOUND" }
      }

      try {
        const download = await getScanReportDownloadUrl(
          params.scanId,
          auth.organizationId
        )
        return { ok: true, data: download }
      } catch (error) {
        set.status = 404
        return {
          ok: false,
          error: error instanceof Error ? error.message : "NOT_FOUND",
        }
      }
    },
    {
      params: t.Object({
        slug: t.String(),
        scanId: t.String(),
      }),
    }
  )
  .post(
    "/stacks/:slug/images/:imageId/rollback",
    async ({ params, set }) => {
      const auth = await withAuth()
      if (!auth.user || !auth.organizationId) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED" }
      }

      const stack = await prisma.applicationStack.findFirst({
        where: { slug: params.slug, organizationId: auth.organizationId },
      })

      if (!stack) {
        set.status = 404
        return { ok: false, error: "STACK_NOT_FOUND" }
      }

      const validation = await validateRollbackImage(
        stack.id,
        params.imageId,
        auth.organizationId
      )

      if (!validation.allowed) {
        set.status = 400
        return {
          ok: false,
          error: validation.reason,
        }
      }

      if (validation.image.deploymentId) {
        const rollbackResult = await rollbackDeployment({
          stackId: stack.id,
          targetDeploymentId: validation.image.deploymentId,
        })
        return {
          ok: true,
          data: {
            deploymentId: rollbackResult.deploymentId,
            imageTag: validation.image.imageTag,
          },
        }
      }

      return {
        ok: true,
        data: {
          imageTag: validation.image.imageTag,
          status: "READY",
        },
      }
    },
    {
      params: t.Object({
        slug: t.String(),
        imageId: t.String(),
      }),
    }
  )
