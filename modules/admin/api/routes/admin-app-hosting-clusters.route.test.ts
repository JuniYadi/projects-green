/**
 * Admin App Hosting Clusters — API Routes Tests
 *
 * Covers: list pagination, create, update, status, integration upsert,
 * secret-safe DTOs, 401/403/409/422, successful responses.
 */

import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import type {
  AdminActorContext,
  AdminApiError,
} from "@/modules/admin/api/admin.guards"
import type { AppHostingClusterEndpointDTO } from "@/modules/deploy/app-hosting-edge.types"
import type {
  ClusterAdminDTO,
  ClusterIntegrationAdminDTO,
} from "@/modules/deploy/cluster-management.dto"

// ── Service mock ─────────────────────────────────────

const mockListClusters = mock(
  async (): Promise<{ clusters: ClusterAdminDTO[]; total: number }> => ({
    clusters: [],
    total: 0,
  })
)

const mockGetClusterById = mock(
  async (): Promise<ClusterAdminDTO | null> => null
)

const mockCreateCluster = mock(async (): Promise<ClusterAdminDTO> => ({
  id: "cl_1",
  code: "us-east-1",
  name: "US East",
  region: "us-east-1",
  regionId: "reg-us-east-1",
  status: "ACTIVE",
  isDefault: false,
  metadataJson: null,
  integrations: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}))

const mockUpdateCluster = mock(async (): Promise<ClusterAdminDTO> => ({
  id: "cl_1",
  code: "us-east-1",
  name: "Updated",
  region: "us-east-1",
  regionId: "reg-us-east-1",
  status: "ACTIVE",
  isDefault: false,
  metadataJson: null,
  integrations: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}))

const mockUpdateClusterStatus = mock(async (): Promise<ClusterAdminDTO> => ({
  id: "cl_1",
  code: "us-east-1",
  name: "US East",
  region: "us-east-1",
  regionId: "reg-us-east-1",
  status: "ACTIVE",
  isDefault: false,
  metadataJson: null,
  integrations: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}))

const mockUpsertClusterIntegration = mock(
  async (): Promise<ClusterIntegrationAdminDTO> => ({
    id: "int_1",
    type: "JENKINS",
    metaJson: {},
    secretPreview: null,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  })
)

const mockUpdateClusterIntegrationStatus = mock(
  async (): Promise<ClusterIntegrationAdminDTO> => ({
    id: "int_1",
    type: "JENKINS",
    metaJson: {},
    secretPreview: null,
    isActive: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  })
)

const mockDeleteClusterIntegration = mock(async () => ({
  id: "int_1",
  clusterId: "cl_1",
  type: "JENKINS",
  deleted: true,
}))

const mockGetClusterEndpoint = mock(
  async (): Promise<AppHostingClusterEndpointDTO> => ({
    id: "endpoint_1",
    clusterId: "cl_1",
    managedBaseDomain: "apps.example.com",
    cnameTarget: "edge.example.net",
    ipv4Addresses: ["203.0.113.10"],
    ipv6Addresses: ["2001:db8::10"],
    isActive: true,
  })
)

const mockUpsertClusterEndpoint = mock(
  async (): Promise<AppHostingClusterEndpointDTO> => ({
    id: "ep_1",
    clusterId: "cl_1",
    managedBaseDomain: "apps.example.com",
    cnameTarget: "edge.example.net",
    ipv4Addresses: ["203.0.113.10"],
    ipv6Addresses: ["2001:db8::10"],
    isActive: true,
  })
)

class EdgeNotFoundError extends Error {}
class EdgeValidationError extends Error {}
class MockClusterIntegrationValidationError extends Error {
  issues: never[] = []
}

mock.module("@/modules/deploy/cluster-management.service", () => ({
  listClusters: mockListClusters,
  getClusterById: mockGetClusterById,
  createCluster: mockCreateCluster,
  updateCluster: mockUpdateCluster,
  updateClusterStatus: mockUpdateClusterStatus,
  upsertClusterIntegration: mockUpsertClusterIntegration,
  updateClusterIntegrationStatus: mockUpdateClusterIntegrationStatus,
  deleteClusterIntegration: mockDeleteClusterIntegration,
  ClusterIntegrationValidationError: MockClusterIntegrationValidationError,
}))
mock.module("@/modules/deploy/app-hosting-edge.service", () => ({
  getClusterEndpoint: mockGetClusterEndpoint,
  upsertClusterEndpoint: mockUpsertClusterEndpoint,
  EdgeNotFoundError,
  EdgeValidationError,
}))

const mockRequireSuperAdmin = mock(
  async (set: unknown): Promise<AdminActorContext | AdminApiError> => {
    ;(set as { status?: number | string }).status = 401
    return {
      ok: false as const,
      error: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    }
  }
)

mock.module("@/modules/admin/api/admin.guards", () => ({
  requireSuperAdmin: mockRequireSuperAdmin,
}))
// ── Dynamic import after mocks ───────────────────────

const { createAdminAppHostingClusterRoutes } =
  await import("@/modules/admin/api/routes/admin-app-hosting-clusters.route")

const BASE = "http://localhost/admin/app-hosting/clusters"

// ── Tests ────────────────────────────────────────────

describe("Admin App Hosting Clusters Routes", () => {
  beforeEach(() => {
    mock.clearAllMocks()
    mockRequireSuperAdmin.mockImplementation(async (set: unknown) => {
      if (set && typeof set === "object" && "status" in set) {
        Object.assign(set, { status: 401 })
      }
      return {
        ok: false as const,
        error: "UNAUTHORIZED",
        message: "You must be signed in to perform this action.",
      }
    })
  })

  // ── Auth guards ────────────────────────────────

  describe("authentication", () => {
    it("returns 401 when not authenticated", async () => {
      const app = new Elysia().use(createAdminAppHostingClusterRoutes())

      const res = await app.handle(new Request(`${BASE}`, {}))

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when not super admin", async () => {
      mockRequireSuperAdmin.mockImplementationOnce(async (set: unknown) => {
        ;(set as { status?: number | string }).status = 403
        return {
          ok: false as const,
          error: "FORBIDDEN",
          message: "This action requires super admin access.",
        }
      })

      const app = new Elysia().use(createAdminAppHostingClusterRoutes())

      const res = await app.handle(new Request(`${BASE}`, {}))

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("FORBIDDEN")
    })
  })

  // ── GET /admin/app-hosting/clusters ────────────

  describe("GET /admin/app-hosting/clusters", () => {
    it("returns paginated clusters", async () => {
      mockRequireSuperAdmin.mockImplementationOnce(async () => ({
        ok: true as const,
        userId: "u1",
        platformRole: "super_admin",
      }))
      mockListClusters.mockResolvedValueOnce({
        clusters: [
          {
            id: "cl_1",
            code: "us-east-1",
            name: "US East",
            region: "us-east-1",
            regionId: "reg-us-east-1",
            status: "ACTIVE",
            isDefault: true,
            metadataJson: null,
            integrations: [],
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        total: 1,
      })

      const app = new Elysia().use(createAdminAppHostingClusterRoutes())

      const res = await app.handle(new Request(`${BASE}?page=1&limit=20`, {}))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data).toHaveLength(1)
      expect(body.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      })
      // Must not leak secretCiphertext
      expect(body.data[0]).not.toHaveProperty("secretCiphertext")
    })
  })

  // ── GET /admin/app-hosting/clusters/:id ────────

  describe("GET /admin/app-hosting/clusters/:id", () => {
    it("returns cluster by id", async () => {
      mockRequireSuperAdmin.mockImplementationOnce(async () => ({
        ok: true as const,
        userId: "u1",
        platformRole: "super_admin",
      }))
      mockGetClusterById.mockResolvedValueOnce({
        id: "cl_1",
        code: "us-east-1",
        name: "US East",
        region: "us-east-1",
        regionId: "reg-us-east-1",
        status: "ACTIVE",
        isDefault: false,
        metadataJson: null,
        integrations: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      })

      const app = new Elysia().use(createAdminAppHostingClusterRoutes())

      const res = await app.handle(new Request(`${BASE}/cl_1`, {}))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data.id).toBe("cl_1")
    })

    it("returns 404 for nonexistent cluster", async () => {
      mockRequireSuperAdmin.mockImplementationOnce(async () => ({
        ok: true as const,
        userId: "u1",
        platformRole: "super_admin",
      }))
      mockGetClusterById.mockResolvedValueOnce(null)

      const app = new Elysia().use(createAdminAppHostingClusterRoutes())

      const res = await app.handle(new Request(`${BASE}/nonexistent`, {}))

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.ok).toBe(false)
    })
  })

  // ── POST /admin/app-hosting/clusters ───────────

  describe("POST /admin/app-hosting/clusters", () => {
    it("creates cluster and returns 201", async () => {
      mockRequireSuperAdmin.mockImplementationOnce(async () => ({
        ok: true as const,
        userId: "u1",
        platformRole: "super_admin",
      }))
      mockCreateCluster.mockResolvedValueOnce({
        id: "cl_new",
        code: "eu-west-1",
        name: "EU West",
        region: "eu-west-1",
        regionId: "reg-eu-west-1",
        status: "PLANNED",
        isDefault: false,
        metadataJson: null,
        integrations: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      })

      const app = new Elysia().use(createAdminAppHostingClusterRoutes())

      const res = await app.handle(
        new Request(`${BASE}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: "eu-west-1",
            name: "EU West",
            region: "eu-west-1",
          }),
        })
      )

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data.code).toBe("eu-west-1")
    })

    it("returns 409 on duplicate code", async () => {
      mockRequireSuperAdmin.mockImplementationOnce(async () => ({
        ok: true as const,
        userId: "u1",
        platformRole: "super_admin",
      }))
      mockCreateCluster.mockRejectedValueOnce(
        new Error("CONFLICT: Code already exists")
      )

      const app = new Elysia().use(createAdminAppHostingClusterRoutes())

      const res = await app.handle(
        new Request(`${BASE}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: "us-east-1",
            name: "US East",
            region: "us-east-1",
          }),
        })
      )

      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.ok).toBe(false)
    })

    it("returns 422 on invalid body", async () => {
      mockRequireSuperAdmin.mockImplementationOnce(async () => ({
        ok: true as const,
        userId: "u1",
        platformRole: "super_admin",
      }))

      const app = new Elysia().use(createAdminAppHostingClusterRoutes())

      const res = await app.handle(
        new Request(`${BASE}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      )

      expect(res.status).toBe(422)
    })
  })

  // ── PATCH /admin/app-hosting/clusters/:id ──────

  describe("PATCH /admin/app-hosting/clusters/:id", () => {
    it("updates cluster metadata", async () => {
      mockRequireSuperAdmin.mockImplementationOnce(async () => ({
        ok: true as const,
        userId: "u1",
        platformRole: "super_admin",
      }))
      mockUpdateCluster.mockResolvedValueOnce({
        id: "cl_1",
        code: "us-east-1",
        name: "Updated Name",
        region: "us-east-1",
        regionId: "reg-us-east-1",
        status: "ACTIVE",
        isDefault: false,
        metadataJson: null,
        integrations: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      })

      const app = new Elysia().use(createAdminAppHostingClusterRoutes())

      const res = await app.handle(
        new Request(`${BASE}/cl_1`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Updated Name" }),
        })
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data.name).toBe("Updated Name")
    })
  })

  // ── PATCH /admin/app-hosting/clusters/:id/status

  describe("PATCH /admin/app-hosting/clusters/:id/status", () => {
    it("updates status and isDefault", async () => {
      mockRequireSuperAdmin.mockImplementationOnce(async () => ({
        ok: true as const,
        userId: "u1",
        platformRole: "super_admin",
      }))
      mockUpdateClusterStatus.mockResolvedValueOnce({
        id: "cl_1",
        code: "us-east-1",
        name: "US East",
        region: "us-east-1",
        regionId: "reg-us-east-1",
        status: "ACTIVE",
        isDefault: true,
        metadataJson: null,
        integrations: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      })

      const app = new Elysia().use(createAdminAppHostingClusterRoutes())

      const res = await app.handle(
        new Request(`${BASE}/cl_1/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "ACTIVE", isDefault: true }),
        })
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data.status).toBe("ACTIVE")
      expect(body.data.isDefault).toBe(true)
    })

    it("returns 409 on invalid default transition", async () => {
      mockRequireSuperAdmin.mockImplementationOnce(async () => ({
        ok: true as const,
        userId: "u1",
        platformRole: "super_admin",
      }))
      mockUpdateClusterStatus.mockRejectedValueOnce(
        new Error(
          "INVALID_DEFAULT_TRANSITION: Cannot deactivate a default cluster"
        )
      )

      const app = new Elysia().use(createAdminAppHostingClusterRoutes())

      const res = await app.handle(
        new Request(`${BASE}/cl_1/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "DEPRECATED" }),
        })
      )

      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.ok).toBe(false)
    })
  })

  // ── PUT /admin/app-hosting/clusters/:id/integrations/:type

  describe("PUT /admin/app-hosting/clusters/:id/integrations/:type", () => {
    it("upserts integration with secrets", async () => {
      mockRequireSuperAdmin.mockImplementationOnce(async () => ({
        ok: true as const,
        userId: "u1",
        platformRole: "super_admin",
      }))
      mockUpsertClusterIntegration.mockResolvedValueOnce({
        id: "int_1",
        type: "JENKINS",
        metaJson: { url: "https://jenkins.example.com" },
        secretPreview: "abcd…efgh",
        isActive: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      })

      const app = new Elysia().use(createAdminAppHostingClusterRoutes())

      const res = await app.handle(
        new Request(`${BASE}/cl_1/integrations/JENKINS`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            metaJson: {
              baseUrl: "https://jenkins.example.com",
              dslOwner: "pfnapp",
              dslRepo: "Jenkins",
              gitCredentialId: "github-token",
            },
            secrets: {
              username: "jenkins-user",
              apiToken: "secret123",
              webhookToken: "webhook123",
            },
          }),
        })
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data.type).toBe("JENKINS")
      // Must never expose ciphertext
      expect(body.data).not.toHaveProperty("secretCiphertext")
      expect(body.data).not.toHaveProperty("secret")
    })

    it("returns 422 for invalid integration type", async () => {
      mockRequireSuperAdmin.mockImplementationOnce(async () => ({
        ok: true as const,
        userId: "u1",
        platformRole: "super_admin",
      }))

      const app = new Elysia().use(createAdminAppHostingClusterRoutes())

      const res = await app.handle(
        new Request(`${BASE}/cl_1/integrations/INVALID`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      )

      expect(res.status).toBe(422)
    })

    it("returns 422 with fieldErrors for invalid OPENSEARCH metaJson", async () => {
      mockRequireSuperAdmin.mockImplementationOnce(async () => ({
        ok: true as const,
        userId: "u1",
        platformRole: "super_admin",
      }))

      const app = new Elysia().use(createAdminAppHostingClusterRoutes())

      const res = await app.handle(
        new Request(`${BASE}/cl_1/integrations/OPENSEARCH`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            metaJson: { host: "", sslVerify: "not-a-boolean" },
          }),
        })
      )

      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("VALIDATION_ERROR")
      expect(body.fieldErrors).toBeDefined()
      expect(body.fieldErrors?.["metaJson.host"]?.[0]).toContain("host")
    })

    it("returns 422 with fieldErrors for invalid PROMETHEUS metaJson", async () => {
      mockRequireSuperAdmin.mockImplementationOnce(async () => ({
        ok: true as const,
        userId: "u1",
        platformRole: "super_admin",
      }))

      const app = new Elysia().use(createAdminAppHostingClusterRoutes())

      const res = await app.handle(
        new Request(`${BASE}/cl_1/integrations/PROMETHEUS`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            metaJson: { endpoint: "" },
          }),
        })
      )

      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("VALIDATION_ERROR")
      expect(body.fieldErrors).toBeDefined()
      expect(body.fieldErrors?.["metaJson.endpoint"]?.[0]).toContain("endpoint")
    })

    it("validates OPENSEARCH integration with valid body", async () => {
      mockRequireSuperAdmin.mockImplementationOnce(async () => ({
        ok: true as const,
        userId: "u1",
        platformRole: "super_admin",
      }))
      mockUpsertClusterIntegration.mockResolvedValueOnce({
        id: "int_1",
        type: "OPENSEARCH",
        metaJson: { host: "https://opensearch.example.com", sslVerify: true },
        secretPreview: null,
        isActive: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      })

      const app = new Elysia().use(createAdminAppHostingClusterRoutes())

      const res = await app.handle(
        new Request(`${BASE}/cl_1/integrations/OPENSEARCH`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            metaJson: {
              host: "https://opensearch.example.com",
              sslVerify: true,
            },
            secrets: { username: "admin", password: "secret" },
          }),
        })
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data.type).toBe("OPENSEARCH")
      expect(body.data).not.toHaveProperty("secretCiphertext")
    })

    it("validates PROMETHEUS integration with valid body", async () => {
      mockRequireSuperAdmin.mockImplementationOnce(async () => ({
        ok: true as const,
        userId: "u1",
        platformRole: "super_admin",
      }))
      mockUpsertClusterIntegration.mockResolvedValueOnce({
        id: "int_1",
        type: "PROMETHEUS",
        metaJson: { endpoint: "https://prometheus.example.com/metrics" },
        secretPreview: null,
        isActive: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      })

      const app = new Elysia().use(createAdminAppHostingClusterRoutes())

      const res = await app.handle(
        new Request(`${BASE}/cl_1/integrations/PROMETHEUS`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            metaJson: { endpoint: "https://prometheus.example.com/metrics" },
            secrets: { username: "admin", password: "secret" },
          }),
        })
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data.type).toBe("PROMETHEUS")
      expect(body.data).not.toHaveProperty("secretCiphertext")
    })
  })

  // ── PATCH .../integrations/:type/status
  describe("PATCH .../integrations/:type/status", () => {
    it("toggles integration isActive", async () => {
      mockRequireSuperAdmin.mockImplementationOnce(async () => ({
        ok: true as const,
        userId: "u1",
        platformRole: "super_admin",
      }))
      mockUpdateClusterIntegrationStatus.mockResolvedValueOnce({
        id: "int_1",
        type: "JENKINS",
        metaJson: {},
        secretPreview: null,
        isActive: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      })

      const app = new Elysia().use(createAdminAppHostingClusterRoutes())

      const res = await app.handle(
        new Request(`${BASE}/cl_1/integrations/JENKINS/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: false }),
        })
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data.isActive).toBe(false)
      // Secret-safe
      expect(body.data).not.toHaveProperty("secretCiphertext")
    })
  })

  // ── DELETE .../integrations/:type

  describe("DELETE .../integrations/:type", () => {
    it("deletes integration successfully", async () => {
      mockRequireSuperAdmin.mockImplementationOnce(async () => ({
        ok: true as const,
        userId: "u1",
        platformRole: "super_admin",
      }))
      mockDeleteClusterIntegration.mockResolvedValueOnce({
        id: "int_1",
        clusterId: "cl_1",
        type: "JENKINS",
        deleted: true,
      })

      const app = new Elysia().use(createAdminAppHostingClusterRoutes())

      const res = await app.handle(
        new Request(`${BASE}/cl_1/integrations/JENKINS`, {
          method: "DELETE",
        })
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data.deleted).toBe(true)
      expect(body.data.type).toBe("JENKINS")
    })
  })
  // ── GET/PUT /admin/app-hosting/clusters/:id/endpoint

  describe("cluster edge endpoint", () => {
    it("returns 401 when endpoint access is unauthenticated", async () => {
      const app = new Elysia().use(
        createAdminAppHostingClusterRoutes({
          requireSuperAdmin: async (set) => {
            if (set && typeof set === "object" && "status" in set) {
              Object.assign(set, { status: 401 })
            }
            return {
              ok: false as const,
              error: "UNAUTHORIZED",
              message: "You must be signed in to perform this action.",
            }
          },
        })
      )

      const res = await app.handle(new Request(`${BASE}/cl_1/endpoint`, {}))

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body).toEqual({
        ok: false,
        error: "UNAUTHORIZED",
        message: "You must be signed in to perform this action.",
      })
    })

    it("returns 403 when endpoint access is not super admin", async () => {
      const forbiddenGuard = async (set: { status?: number | string }) => {
        if (set && typeof set === "object" && "status" in set) {
          Object.assign(set, { status: 403 })
        }
        return {
          ok: false as const,
          error: "FORBIDDEN",
          message: "This action requires super admin access.",
        }
      }

      const app = new Elysia().use(
        createAdminAppHostingClusterRoutes({
          requireSuperAdmin: forbiddenGuard,
        })
      )

      const res = await app.handle(new Request(`${BASE}/cl_1/endpoint`, {}))

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns the cluster endpoint without secrets", async () => {
      const successGuard = async () => ({
        ok: true as const,
        userId: "u1",
        platformRole: "super_admin" as const,
      })

      const app = new Elysia().use(
        createAdminAppHostingClusterRoutes({ requireSuperAdmin: successGuard })
      )

      const res = await app.handle(new Request(`${BASE}/cl_1/endpoint`, {}))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toEqual({
        ok: true,
        data: {
          id: "endpoint_1",
          clusterId: "cl_1",
          managedBaseDomain: "apps.example.com",
          cnameTarget: "edge.example.net",
          ipv4Addresses: ["203.0.113.10"],
          ipv6Addresses: ["2001:db8::10"],
          isActive: true,
        },
      })
      expect(body.data).not.toHaveProperty("secretCiphertext")
      expect(mockGetClusterEndpoint).toHaveBeenCalledWith("cl_1")
    })

    it("maps a missing cluster endpoint to 404", async () => {
      mockRequireSuperAdmin.mockImplementationOnce(async () => ({
        ok: true as const,
        userId: "u1",
        platformRole: "super_admin",
      }))
      mockGetClusterEndpoint.mockRejectedValueOnce(
        new EdgeNotFoundError("cluster edge endpoint not found")
      )

      const app = new Elysia().use(createAdminAppHostingClusterRoutes())

      const res = await app.handle(
        new Request(`${BASE}/cl_missing/endpoint`, {})
      )

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body).toEqual({
        ok: false,
        error: "NOT_FOUND",
        message: "cluster edge endpoint not found",
      })
    })
    it("upserts a cluster endpoint", async () => {
      mockRequireSuperAdmin.mockImplementationOnce(async () => ({
        ok: true as const,
        userId: "u1",
        platformRole: "super_admin",
      }))
      mockUpsertClusterEndpoint.mockResolvedValueOnce({
        id: "endpoint_1",
        clusterId: "cl_1",
        managedBaseDomain: "apps.example.org",
        cnameTarget: "edge.example.net",
        ipv4Addresses: ["203.0.113.20"],
        ipv6Addresses: [],
        isActive: false,
      })

      const input = {
        managedBaseDomain: "apps.example.org",
        cnameTarget: "edge.example.net",
        ipv4Addresses: ["203.0.113.20"],
        ipv6Addresses: [],
        isActive: false,
      }
      const app = new Elysia().use(createAdminAppHostingClusterRoutes())

      const res = await app.handle(
        new Request(`${BASE}/cl_1/endpoint`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        })
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data.managedBaseDomain).toBe("apps.example.org")
      expect(body.data.isActive).toBe(false)
      expect(body.data).not.toHaveProperty("secretCiphertext")
      expect(mockUpsertClusterEndpoint).toHaveBeenCalledWith("cl_1", input)
    })

    it("returns 422 for an invalid endpoint body", async () => {
      mockRequireSuperAdmin.mockImplementationOnce(async () => ({
        ok: true as const,
        userId: "u1",
        platformRole: "super_admin",
      }))

      const app = new Elysia().use(createAdminAppHostingClusterRoutes())

      const res = await app.handle(
        new Request(`${BASE}/cl_1/endpoint`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ managedBaseDomain: "not-a-hostname" }),
        })
      )

      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body).toBeDefined()
    })

    it("maps edge validation errors to 422", async () => {
      mockRequireSuperAdmin.mockImplementationOnce(async () => ({
        ok: true as const,
        userId: "u1",
        platformRole: "super_admin",
      }))
      mockUpsertClusterEndpoint.mockRejectedValueOnce(
        new EdgeValidationError(
          "ipv4Addresses must contain only IPv4 addresses"
        )
      )

      const app = new Elysia().use(createAdminAppHostingClusterRoutes())

      const res = await app.handle(
        new Request(`${BASE}/cl_1/endpoint`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            managedBaseDomain: "apps.example.com",
            cnameTarget: "edge.example.net",
            ipv4Addresses: ["203.0.113.10"],
            ipv6Addresses: [],
            isActive: true,
          }),
        })
      )

      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("VALIDATION_ERROR")
      expect(body.message).toBe(
        "ipv4Addresses must contain only IPv4 addresses"
      )
    })

    it("maps unexpected endpoint errors to 500", async () => {
      mockRequireSuperAdmin.mockImplementationOnce(async () => ({
        ok: true as const,
        userId: "u1",
        platformRole: "super_admin",
      }))
      mockGetClusterEndpoint.mockRejectedValueOnce(
        new Error("database unavailable")
      )

      const app = new Elysia().use(createAdminAppHostingClusterRoutes())

      const res = await app.handle(new Request(`${BASE}/cl_1/endpoint`, {}))

      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body).toEqual({
        ok: false,
        error: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
      })
    })
  })
})
