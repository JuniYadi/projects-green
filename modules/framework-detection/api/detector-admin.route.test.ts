import { describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

import { createDetectorAdminRoutes } from "@/modules/framework-detection/api/detector-admin.route"

// --- Mocks ---

const createMockDetectorRule = (overrides = {}) => ({
  id: "rule-1",
  name: "Laravel Artisan Rule",
  description: "Detect Laravel by artisan file",
  patternJson: { files: ["artisan"] },
  implicationsJson: { framework: "laravel", impact: "HINT" },
  confidenceWeight: 0.9,
  isActive: true,
  priority: 10,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-02"),
  ...overrides,
})

const createMockRuntimeMapping = (overrides = {}) => ({
  id: "mapping-1",
  frameworkId: "laravel",
  frameworkVersion: "10",
  runtimeId: "php",
  runtimeVersion: "8.2",
  buildVersion: "node-20",
  isActive: true,
  priority: 10,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const createMockInspectionLog = (overrides = {}) => ({
  id: "log-1",
  installationId: BigInt(12345),
  repoUrl: "https://github.com/org/repo",
  ref: "main",
  detectedFramework: "laravel",
  confidence: 0.92,
  enforcedRuntimes: [{ runtimeId: "php", version: "8.2" }],
  toolCalls: [],
  reasoning: ["artisan found"],
  warnings: [],
  durationMs: 1500,
  status: "success",
  blockedByRuleId: null,
  errorMessage: null,
  createdAt: new Date("2026-01-01"),
  ...overrides,
})

// Mock requireSuperAdmin that always passes
const mockGuardPass = async () => ({
  ok: true as const,
  userId: "admin-1",
  platformRole: "super_admin" as const,
})

// Mock requireSuperAdmin that always fails
const mockGuardFail = async () => ({
  ok: false as const,
  error: "FORBIDDEN" as const,
  message: "Super admin access required.",
})

describe("detectorAdminRoutes", () => {
  // === DetectorRule CRUD ===
  describe("GET /admin/detector/rules", () => {
    it("returns rules list for super admin", async () => {
      const mockRules = [createMockDetectorRule()]
      const mockListRules = mock(() => Promise.resolve(mockRules))

      const app = new Elysia().use(
        createDetectorAdminRoutes({
          requireSuperAdmin: mockGuardPass,
          listDetectorRules: mockListRules,
        })
      )

      const response = await app.handle(
        new Request("http://localhost/admin/detector/rules")
      )
      const body = (await response.json()) as {
        ok: boolean
        data: unknown[]
      }

      expect(response.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.data).toHaveLength(1)
    })
  })

  describe("POST /admin/detector/rules", () => {
    it("returns 403 for non-admin", async () => {
      const app = new Elysia().use(
        createDetectorAdminRoutes({
          requireSuperAdmin: mockGuardFail,
        })
      )

      const response = await app.handle(
        new Request("http://localhost/admin/detector/rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Test Rule",
            patternJson: { files: ["test.txt"] },
            implicationsJson: { framework: "test", impact: "HINT" },
          }),
        })
      )

      const body = (await response.json()) as { ok: boolean; error: string }

      // Guard returns error object with ok: false
      expect(body.ok).toBe(false)
    })

    it("creates a rule for valid payload", async () => {
      const mockRule = createMockDetectorRule()
      const mockCreate = mock(() => Promise.resolve(mockRule))

      const app = new Elysia().use(
        createDetectorAdminRoutes({
          requireSuperAdmin: mockGuardPass,
          createDetectorRule: mockCreate,
        })
      )

      const response = await app.handle(
        new Request("http://localhost/admin/detector/rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Test Rule",
            patternJson: { files: ["artisan"] },
            implicationsJson: { framework: "laravel", impact: "HINT" },
          }),
        })
      )

      const body = (await response.json()) as {
        ok: boolean
        data: { id: string; name: string }
      }

      expect(response.status).toBe(201)
      expect(body.ok).toBe(true)
      expect(body.data.name).toBe("Laravel Artisan Rule")
    })

    it("returns 400 for missing name", async () => {
      const app = new Elysia().use(
        createDetectorAdminRoutes({
          requireSuperAdmin: mockGuardPass,
        })
      )

      const response = await app.handle(
        new Request("http://localhost/admin/detector/rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patternJson: { files: ["artisan"] },
            implicationsJson: { framework: "laravel" },
          }),
        })
      )

      // Elysia returns 422 for validation errors by default
      expect(response.status).toBe(422)
    })
  })

  describe("PATCH /admin/detector/rules/:id", () => {
    it("returns 404 for non-existent rule", async () => {
      const mockGetById = mock(() => Promise.resolve(null))

      const app = new Elysia().use(
        createDetectorAdminRoutes({
          requireSuperAdmin: mockGuardPass,
          getDetectorRuleById: mockGetById,
        })
      )

      const response = await app.handle(
        new Request("http://localhost/admin/detector/rules/non-existent", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Updated" }),
        })
      )

      const body = (await response.json()) as {
        ok: boolean
        error: string
      }

      expect(response.status).toBe(404)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("NOT_FOUND")
    })

    it("updates a rule for valid payload", async () => {
      const existingRule = createMockDetectorRule()
      const updatedRule = createMockDetectorRule({
        name: "Updated Rule",
      })
      const mockGetById = mock(() => Promise.resolve(existingRule))
      const mockUpdate = mock(() => Promise.resolve(updatedRule))

      const app = new Elysia().use(
        createDetectorAdminRoutes({
          requireSuperAdmin: mockGuardPass,
          getDetectorRuleById: mockGetById,
          updateDetectorRule: mockUpdate,
        })
      )

      const response = await app.handle(
        new Request("http://localhost/admin/detector/rules/rule-1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Updated Rule" }),
        })
      )

      const body = (await response.json()) as {
        ok: boolean
        data: { name: string }
      }

      expect(response.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.data.name).toBe("Updated Rule")
    })
  })

  describe("DELETE /admin/detector/rules/:id", () => {
    it("deletes a rule", async () => {
      const existingRule = createMockDetectorRule()
      const mockGetById = mock(() => Promise.resolve(existingRule))
      const mockDelete = mock(() => Promise.resolve(existingRule))

      const app = new Elysia().use(
        createDetectorAdminRoutes({
          requireSuperAdmin: mockGuardPass,
          getDetectorRuleById: mockGetById,
          deleteDetectorRule: mockDelete,
        })
      )

      const response = await app.handle(
        new Request("http://localhost/admin/detector/rules/rule-1", {
          method: "DELETE",
        })
      )

      const body = (await response.json()) as {
        ok: boolean
        data: { id: string }
      }

      expect(response.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.data.id).toBe("rule-1")
    })
  })

  // === RuntimeMapping CRUD ===
  describe("GET /admin/detector/mappings", () => {
    it("returns mappings list", async () => {
      const mockMappings = [createMockRuntimeMapping()]
      const mockList = mock(() => Promise.resolve(mockMappings))

      const app = new Elysia().use(
        createDetectorAdminRoutes({
          requireSuperAdmin: mockGuardPass,
          listRuntimeMappings: mockList,
        })
      )

      const response = await app.handle(
        new Request("http://localhost/admin/detector/mappings")
      )
      const body = (await response.json()) as {
        ok: boolean
        data: unknown[]
      }

      expect(response.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.data).toHaveLength(1)
    })
  })

  describe("POST /admin/detector/mappings", () => {
    it("creates a mapping for valid payload", async () => {
      const mockMapping = createMockRuntimeMapping()
      const mockCreate = mock(() => Promise.resolve(mockMapping))

      const app = new Elysia().use(
        createDetectorAdminRoutes({
          requireSuperAdmin: mockGuardPass,
          createRuntimeMapping: mockCreate,
        })
      )

      const response = await app.handle(
        new Request("http://localhost/admin/detector/mappings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            frameworkId: "laravel",
            runtimeId: "php",
            runtimeVersion: "8.2",
          }),
        })
      )

      const body = (await response.json()) as {
        ok: boolean
        data: { frameworkId: string; runtimeId: string }
      }

      expect(response.status).toBe(201)
      expect(body.ok).toBe(true)
      expect(body.data.frameworkId).toBe("laravel")
    })
  })

  // === Inspection Logs ===
  describe("GET /admin/detector/logs", () => {
    it("returns logs list", async () => {
      const mockLogs = [createMockInspectionLog()]
      const mockList = mock(() => Promise.resolve({ logs: mockLogs, total: 1 }))

      const app = new Elysia().use(
        createDetectorAdminRoutes({
          requireSuperAdmin: mockGuardPass,
          listInspectionLogs: mockList,
        })
      )

      const response = await app.handle(
        new Request("http://localhost/admin/detector/logs")
      )
      const body = (await response.json()) as {
        ok: boolean
        data: { logs: unknown[]; total: number }
      }

      expect(response.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.data.logs).toHaveLength(1)
      expect(body.data.total).toBe(1)
    })

    it("passes query filters", async () => {
      const mockList = mock(() => Promise.resolve({ logs: [], total: 0 }))

      const app = new Elysia().use(
        createDetectorAdminRoutes({
          requireSuperAdmin: mockGuardPass,
          listInspectionLogs: mockList,
        })
      )

      await app.handle(
        new Request(
          "http://localhost/admin/detector/logs?status=error&limit=10&offset=5"
        )
      )

      expect(mockList).toHaveBeenCalledWith({
        limit: 10,
        offset: 5,
        status: "error",
        repoUrl: undefined,
        framework: undefined,
      })
    })
  })

  // === AI Recommendations ===
  describe("POST /admin/detector/recommend", () => {
    it("returns recommendations", async () => {
      const mockRecs = [
        {
          id: "rec-1",
          suggestedName: "Auto-detect laravel",
          suggestedDescription: "Rule based on 5 detections",
          suggestedPatternJson: { files: [], dependencies: [] },
          suggestedImplicationsJson: { framework: "laravel", impact: "HINT" },
          suggestedConfidenceWeight: 0.8,
          suggestedPriority: 5,
          reasoning: "Test reasoning",
          basedOnLogIds: ["log-1", "log-2"],
        },
      ]
      const mockRecommend = mock(() => Promise.resolve(mockRecs))

      const app = new Elysia().use(
        createDetectorAdminRoutes({
          requireSuperAdmin: mockGuardPass,
          generateRuleRecommendations: mockRecommend,
        })
      )

      const response = await app.handle(
        new Request("http://localhost/admin/detector/recommend", {
          method: "POST",
        })
      )

      const body = (await response.json()) as {
        ok: boolean
        data: unknown[]
      }

      expect(response.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.data).toHaveLength(1)
    })
  })
})
