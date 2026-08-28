import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"

// ── Mock AuthKit, Prisma, and Services ─────────────────

const mockAuth: {
  user: { id: string; email: string } | null
  organizationId: string | null
} = {
  user: { id: "user_1", email: "user@example.com" },
  organizationId: "org_1",
}

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mock(async () => mockAuth),
}))

const mockPrisma = {
  applicationDeployment: {
    findUnique: mock(),
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

const mockGetDeployEvents = mock()
const mockGetDeployLogs = mock()

mock.module("../../deploy-event.service", () => ({
  getDeployEvents: mockGetDeployEvents,
  getDeployLogs: mockGetDeployLogs,
}))

const mockGetMonitorStats = mock()

mock.module("../../deploy-monitor.service", () => ({
  getMonitorStats: mockGetMonitorStats,
}))

// Test seam: dynamic import after mock.module to ensure mock resolution
const { deployPipelineRoutes } = await import("./deploy-pipeline.route")

describe("deployPipelineRoutes", () => {
  const app = new Elysia().use(deployPipelineRoutes).compile()

  beforeEach(() => {
    mockAuth.user = { id: "user_1", email: "user@example.com" }
    mockAuth.organizationId = "org_1"

    mockPrisma.applicationDeployment.findUnique.mockReset()
    mockGetDeployEvents.mockReset()
    mockGetDeployLogs.mockReset()
    mockGetMonitorStats.mockReset()
  })

  describe("GET /deploy/pipeline/status/:deployId", () => {
    it("returns 401 when user is not authenticated", async () => {
      mockAuth.user = null

      const res = await app.handle(
        new Request("http://localhost/deploy/pipeline/status/dep_1")
      )

      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("UNAUTHORIZED")
    })

    it("returns 404 when deployment is not found", async () => {
      mockPrisma.applicationDeployment.findUnique.mockResolvedValueOnce(null)

      const res = await app.handle(
        new Request("http://localhost/deploy/pipeline/status/dep_nonexistent")
      )

      expect(res.status).toBe(404)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("NOT_FOUND")
    })

    it("returns 403 when deployment belongs to another organization", async () => {
      mockPrisma.applicationDeployment.findUnique.mockResolvedValueOnce({
        id: "dep_1",
        organizationId: "org_other",
        stack: { name: "Web App", slug: "web-app" },
      })

      const res = await app.handle(
        new Request("http://localhost/deploy/pipeline/status/dep_1")
      )

      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("FORBIDDEN")
    })

    it("returns 200 with deployment status data when authorized", async () => {
      const now = new Date()
      mockPrisma.applicationDeployment.findUnique.mockResolvedValueOnce({
        id: "dep_1",
        organizationId: "org_1",
        status: "RUNNING",
        manifestPushed: true,
        manifestPushedAt: now,
        argocdSynced: false,
        argocdSyncedAt: null,
        startedAt: now,
        completedAt: null,
        failureReason: null,
        attempt: 1,
        stack: {
          name: "Web App",
          slug: "web-app",
        },
      })

      const res = await app.handle(
        new Request("http://localhost/deploy/pipeline/status/dep_1")
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.ok).toBe(true)
      expect(json.data.id).toBe("dep_1")
      expect(json.data.stackName).toBe("Web App")
      expect(json.data.stackSlug).toBe("web-app")
      expect(json.data.status).toBe("RUNNING")
      expect(json.data.manifestPushed).toBe(true)
    })
  })

  describe("GET /deploy/pipeline/events/:deployId", () => {
    it("returns 401 when user is not authenticated", async () => {
      mockAuth.user = null

      const res = await app.handle(
        new Request("http://localhost/deploy/pipeline/events/dep_1")
      )

      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("UNAUTHORIZED")
    })

    it("returns 404 when deployment is not found", async () => {
      mockPrisma.applicationDeployment.findUnique.mockResolvedValueOnce(null)

      const res = await app.handle(
        new Request("http://localhost/deploy/pipeline/events/dep_nonexistent")
      )

      expect(res.status).toBe(404)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("NOT_FOUND")
    })

    it("returns 403 when deployment belongs to another organization", async () => {
      mockPrisma.applicationDeployment.findUnique.mockResolvedValueOnce({
        id: "dep_1",
        organizationId: "org_other",
      })

      const res = await app.handle(
        new Request("http://localhost/deploy/pipeline/events/dep_1")
      )

      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("FORBIDDEN")
    })

    it("returns 200 with deployment events when authorized", async () => {
      mockPrisma.applicationDeployment.findUnique.mockResolvedValueOnce({
        id: "dep_1",
        organizationId: "org_1",
      })
      const events = [
        {
          id: "evt_1",
          deploymentId: "dep_1",
          type: "BUILD_STARTED",
          message: "Build started",
          createdAt: new Date(),
        },
      ]
      mockGetDeployEvents.mockResolvedValueOnce(events)

      const res = await app.handle(
        new Request("http://localhost/deploy/pipeline/events/dep_1")
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.ok).toBe(true)
      expect(json.data).toHaveLength(1)
      expect(json.data[0].type).toBe("BUILD_STARTED")
      expect(mockGetDeployEvents).toHaveBeenCalledWith("dep_1")
    })
  })

  describe("GET /deploy/pipeline/logs/:deployId", () => {
    it("returns 401 when user is not authenticated", async () => {
      mockAuth.user = null

      const res = await app.handle(
        new Request("http://localhost/deploy/pipeline/logs/dep_1")
      )

      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("UNAUTHORIZED")
    })

    it("returns 404 when deployment is not found", async () => {
      mockPrisma.applicationDeployment.findUnique.mockResolvedValueOnce(null)

      const res = await app.handle(
        new Request("http://localhost/deploy/pipeline/logs/dep_nonexistent")
      )

      expect(res.status).toBe(404)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("NOT_FOUND")
    })

    it("returns 403 when deployment belongs to another organization", async () => {
      mockPrisma.applicationDeployment.findUnique.mockResolvedValueOnce({
        id: "dep_1",
        organizationId: "org_other",
      })

      const res = await app.handle(
        new Request("http://localhost/deploy/pipeline/logs/dep_1")
      )

      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("FORBIDDEN")
    })

    it("returns 200 with deployment logs when authorized", async () => {
      mockPrisma.applicationDeployment.findUnique.mockResolvedValueOnce({
        id: "dep_1",
        organizationId: "org_1",
      })
      const logs = [
        {
          id: "log_1",
          deploymentId: "dep_1",
          scope: "builder",
          status: "INFO",
          message: "Step 1/5: FROM node:20-alpine",
          timestamp: new Date(),
        },
      ]
      mockGetDeployLogs.mockResolvedValueOnce(logs)

      const res = await app.handle(
        new Request("http://localhost/deploy/pipeline/logs/dep_1")
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.ok).toBe(true)
      expect(json.data).toHaveLength(1)
      expect(json.data[0].scope).toBe("builder")
      expect(mockGetDeployLogs).toHaveBeenCalledWith("dep_1")
    })
  })

  describe("GET /deploy/pipeline/monitor-stats", () => {
    it("returns 401 when user is not authenticated", async () => {
      mockAuth.user = null

      const res = await app.handle(
        new Request("http://localhost/deploy/pipeline/monitor-stats")
      )

      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error).toBe("UNAUTHORIZED")
    })

    it("returns 200 with monitor stats when authorized", async () => {
      const stats = {
        activeDeployments: 3,
        queuedDeployments: 1,
        successRate: 0.95,
      }
      mockGetMonitorStats.mockResolvedValueOnce(stats)

      const res = await app.handle(
        new Request("http://localhost/deploy/pipeline/monitor-stats")
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.ok).toBe(true)
      expect(json.data).toEqual(stats)
      expect(mockGetMonitorStats).toHaveBeenCalled()
    })
  })
})
