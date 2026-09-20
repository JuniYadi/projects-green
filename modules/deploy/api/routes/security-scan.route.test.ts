import { beforeEach, describe, expect, it, mock } from "bun:test"
import { createJenkinsWebhookHeaders } from "../../jenkins-webhook-auth"

const mockAuth = {
  user: { id: "usr_123" },
  organizationId: "org_test",
}

const mockPrisma = {
  applicationStack: {
    findFirst: mock(),
  },
}

const mockCluster = {
  resolveClusterIntegration: mock(),
}

const mockSecurityScanService = {
  createScanPresignedUploadUrl: mock(),
  confirmSecurityScan: mock(),
  getSecurityOverview: mock(),
  getScanFindings: mock(),
  getScanReportDownloadUrl: mock(),
}

const mockContainerImageService = {
  getStackContainerImages: mock(),
  validateRollbackImage: mock(),
}

const mockDeployRollbackService = {
  rollbackDeployment: mock(),
}

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: async () => mockAuth,
}))

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))
mock.module("../../cluster-integration.service", () => mockCluster)
mock.module("../../security-scan.service", () => mockSecurityScanService)
mock.module("../../container-image.service", () => mockContainerImageService)
mock.module("../../deploy-rollback.service", () => mockDeployRollbackService)

const { securityScanRoutes } = await import("./security-scan.route")

const app = securityScanRoutes

describe("security-scan.route", () => {
  const secret = "test-webhook-token"

  beforeEach(() => {
    mockPrisma.applicationStack.findFirst.mockClear()
    mockCluster.resolveClusterIntegration.mockClear()
    mockSecurityScanService.createScanPresignedUploadUrl.mockClear()
    mockSecurityScanService.confirmSecurityScan.mockClear()
    mockSecurityScanService.getSecurityOverview.mockClear()
    mockSecurityScanService.getScanFindings.mockClear()
    mockContainerImageService.getStackContainerImages.mockClear()
    mockContainerImageService.validateRollbackImage.mockClear()
    mockDeployRollbackService.rollbackDeployment.mockClear()
  })

  describe("POST /deploy/stacks/:slug/scan-presign", () => {
    it("returns 401 when HMAC signature is invalid", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValue({
        id: "stack-1",
        slug: "my-app",
        organizationId: "org_test",
      })
      mockCluster.resolveClusterIntegration.mockResolvedValue({
        webhookToken: secret,
      })

      const body = { imageTag: "2" }
      const res = await app.handle(
        new Request("http://localhost/deploy/stacks/my-app/scan-presign", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-jenkins-signature-256": "invalid-sig",
            "x-jenkins-timestamp": Math.floor(Date.now() / 1000).toString(),
          },
          body: JSON.stringify(body),
        })
      )

      expect(res.status).toBe(401)
    })

    it("returns 200 with uploadUrl and storageKey when signature is valid", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValue({
        id: "stack-1",
        slug: "my-app",
        organizationId: "org_test",
      })
      mockCluster.resolveClusterIntegration.mockResolvedValue({
        webhookToken: secret,
      })
      mockSecurityScanService.createScanPresignedUploadUrl.mockResolvedValue({
        uploadUrl: "https://s3.example.com/upload",
        storageKey: "storage/key.json",
      })

      const body = { imageTag: "2" }
      const rawBody = JSON.stringify(body)
      const headers = createJenkinsWebhookHeaders(rawBody, secret)

      const res = await app.handle(
        new Request("http://localhost/deploy/stacks/my-app/scan-presign", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...headers,
          },
          body: rawBody,
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.data.uploadUrl).toBe("https://s3.example.com/upload")
    })

    it("verifies exact raw body HMAC with formatted JSON and token", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValue({
        id: "stack-1",
        slug: "my-app",
        organizationId: "org_test",
      })
      mockCluster.resolveClusterIntegration.mockResolvedValue({
        webhookToken: secret,
      })
      mockSecurityScanService.createScanPresignedUploadUrl.mockResolvedValue({
        uploadUrl: "https://s3.example.com/upload",
        storageKey: "storage/key.json",
      })

      const rawBody = JSON.stringify(
        { imageTag: "2", token: "legacy-tok", extraField: 123 },
        null,
        2
      )
      const headers = createJenkinsWebhookHeaders(rawBody, secret)

      const res = await app.handle(
        new Request("http://localhost/deploy/stacks/my-app/scan-presign", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...headers,
          },
          body: rawBody,
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.data.uploadUrl).toBe("https://s3.example.com/upload")
    })
  })

  describe("POST /deploy/stacks/:slug/scan-confirm", () => {
    it("returns 202 Accepted and queues ingestion when signature is valid", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValue({
        id: "stack-1",
        slug: "my-app",
        organizationId: "org_test",
      })
      mockCluster.resolveClusterIntegration.mockResolvedValue({
        webhookToken: secret,
      })
      mockSecurityScanService.confirmSecurityScan.mockResolvedValue({
        scanId: "scan-123",
        queued: true,
      })

      const body = {
        imageTag: "2",
        storageKey: "storage/key.json",
        criticalCount: 0,
        highCount: 1,
        mediumCount: 3,
        lowCount: 5,
      }
      const rawBody = JSON.stringify(body)
      const headers = createJenkinsWebhookHeaders(rawBody, secret)

      const res = await app.handle(
        new Request("http://localhost/deploy/stacks/my-app/scan-confirm", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...headers,
          },
          body: rawBody,
        })
      )

      expect(res.status).toBe(202)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.data.scanId).toBe("scan-123")
      expect(data.data.queued).toBe(true)
    })

    it("verifies exact raw body HMAC with formatted JSON and token on confirm", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValue({
        id: "stack-1",
        slug: "my-app",
        organizationId: "org_test",
      })
      mockCluster.resolveClusterIntegration.mockResolvedValue({
        webhookToken: secret,
      })
      mockSecurityScanService.confirmSecurityScan.mockResolvedValue({
        scanId: "scan-123",
        queued: true,
      })

      const rawBody = JSON.stringify(
        {
          imageTag: "2",
          storageKey: "storage/key.json",
          criticalCount: 0,
          highCount: 1,
          mediumCount: 3,
          lowCount: 5,
          token: "legacy-tok",
          extraProp: "xyz",
        },
        null,
        2
      )
      const headers = createJenkinsWebhookHeaders(rawBody, secret)

      const res = await app.handle(
        new Request("http://localhost/deploy/stacks/my-app/scan-confirm", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...headers,
          },
          body: rawBody,
        })
      )

      expect(res.status).toBe(202)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.data.scanId).toBe("scan-123")
    })
  })

  describe("GET /deploy/stacks/:slug/security-overview", () => {
    it("returns security overview for stack", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValue({
        id: "stack-1",
        slug: "my-app",
        organizationId: "org_test",
      })
      mockSecurityScanService.getSecurityOverview.mockResolvedValue({
        activeImage: { imageTag: "2", status: "ACTIVE" },
        latestScan: { status: "WARNING", highCount: 1 },
      })

      const res = await app.handle(
        new Request("http://localhost/deploy/stacks/my-app/security-overview", {
          method: "GET",
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.data.activeImage.imageTag).toBe("2")
      expect(data.data.latestScan.status).toBe("WARNING")
    })
  })

  describe("GET /deploy/stacks/:slug/images", () => {
    it("returns container images for stack", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValue({
        id: "stack-1",
        slug: "my-app",
        organizationId: "org_test",
      })
      mockContainerImageService.getStackContainerImages.mockResolvedValue([
        { imageTag: "2", status: "ACTIVE" },
        { imageTag: "1", status: "READY" },
      ])

      const res = await app.handle(
        new Request("http://localhost/deploy/stacks/my-app/images", {
          method: "GET",
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.data).toHaveLength(2)
    })
  })

  describe("POST /deploy/stacks/:slug/images/:imageId/rollback", () => {
    it("rejects rollback with 400 when validation fails", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValue({
        id: "stack-1",
        slug: "my-app",
        organizationId: "org_test",
      })
      mockContainerImageService.validateRollbackImage.mockResolvedValue({
        allowed: false,
        reason: "This image has been auto-rotated to save space.",
      })

      const res = await app.handle(
        new Request(
          "http://localhost/deploy/stacks/my-app/images/img-expired/rollback",
          {
            method: "POST",
          }
        )
      )

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.ok).toBe(false)
      expect(data.error).toContain("auto-rotated to save space")
    })

    it("triggers rollback successfully when validation passes", async () => {
      mockPrisma.applicationStack.findFirst.mockResolvedValue({
        id: "stack-1",
        slug: "my-app",
        organizationId: "org_test",
      })
      mockContainerImageService.validateRollbackImage.mockResolvedValue({
        allowed: true,
        image: {
          id: "img-1",
          imageTag: "1",
          deploymentId: "dep-1",
        },
      })
      mockDeployRollbackService.rollbackDeployment.mockResolvedValue({
        deploymentId: "deploy-rollback-1",
        status: "QUEUED",
      })

      const res = await app.handle(
        new Request(
          "http://localhost/deploy/stacks/my-app/images/img-1/rollback",
          {
            method: "POST",
          }
        )
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.data.deploymentId).toBe("deploy-rollback-1")
      expect(data.data.imageTag).toBe("1")
    })
  })
})
