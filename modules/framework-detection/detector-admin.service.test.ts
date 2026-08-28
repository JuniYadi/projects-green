import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockRuleFindMany = mock(() => Promise.resolve([]))
const mockRuleFindUnique = mock(() => Promise.resolve(null))
const mockRuleCreate = mock(() => Promise.resolve({}))
const mockRuleUpdate = mock(() => Promise.resolve({}))
const mockRuleDelete = mock(() => Promise.resolve({}))

const mockMappingFindMany = mock(() => Promise.resolve([]))
const mockMappingFindUnique = mock(() => Promise.resolve(null))
const mockMappingCreate = mock(() => Promise.resolve({}))
const mockMappingUpdate = mock(() => Promise.resolve({}))
const mockMappingDelete = mock(() => Promise.resolve({}))

const mockLogFindMany = mock(() => Promise.resolve([]))
const mockLogFindUnique = mock(() => Promise.resolve(null))
const mockLogCount = mock(() => Promise.resolve(0))

mock.module("@/lib/prisma", () => ({
  prisma: {
    detectorRule: {
      findMany: mockRuleFindMany,
      findUnique: mockRuleFindUnique,
      create: mockRuleCreate,
      update: mockRuleUpdate,
      delete: mockRuleDelete,
    },
    detectorRuntimeMapping: {
      findMany: mockMappingFindMany,
      findUnique: mockMappingFindUnique,
      create: mockMappingCreate,
      update: mockMappingUpdate,
      delete: mockMappingDelete,
    },
    detectorInspectionLog: {
      findMany: mockLogFindMany,
      findUnique: mockLogFindUnique,
      count: mockLogCount,
    },
  },
}))

import {
  createDetectorRule,
  createRuntimeMapping,
  deleteDetectorRule,
  deleteRuntimeMapping,
  generateRuleRecommendations,
  getDetectorRuleById,
  getInspectionLogById,
  getRuntimeMappingById,
  listDetectorRules,
  listInspectionLogs,
  listRuntimeMappings,
  updateDetectorRule,
  updateRuntimeMapping,
} from "./detector-admin.service"

describe("detector-admin.service", () => {
  beforeEach(() => {
    mockRuleFindMany.mockClear()
    mockRuleFindUnique.mockClear()
    mockRuleCreate.mockClear()
    mockRuleUpdate.mockClear()
    mockRuleDelete.mockClear()
    mockMappingFindMany.mockClear()
    mockMappingFindUnique.mockClear()
    mockMappingCreate.mockClear()
    mockMappingUpdate.mockClear()
    mockMappingDelete.mockClear()
    mockLogFindMany.mockClear()
    mockLogFindUnique.mockClear()
    mockLogCount.mockClear()
  })

  describe("DetectorRule CRUD", () => {
    it("lists active rules by default", async () => {
      mockRuleFindMany.mockResolvedValueOnce([
        { id: "r-1", name: "nextjs", isActive: true },
      ] as unknown as never)

      const res = await listDetectorRules()

      expect(res).toHaveLength(1)
      expect(mockRuleFindMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      })
    })

    it("gets rule by id", async () => {
      mockRuleFindUnique.mockResolvedValueOnce({
        id: "r-1",
      } as unknown as never)

      const res = await getDetectorRuleById("r-1")

      expect(res).toEqual({ id: "r-1" } as unknown as never)
    })

    it("creates detector rule", async () => {
      mockRuleCreate.mockResolvedValueOnce({
        id: "r-new",
        name: "remix",
      } as unknown as never)

      const res = await createDetectorRule({
        name: "remix",
        patternJson: { files: ["remix.config.js"] },
        implicationsJson: { runtime: "node" },
      })

      expect(res).toEqual({ id: "r-new", name: "remix" } as unknown as never)
    })

    it("updates detector rule", async () => {
      mockRuleUpdate.mockResolvedValueOnce({
        id: "r-1",
        confidenceWeight: 0.95,
      } as unknown as never)

      const res = await updateDetectorRule("r-1", { confidenceWeight: 0.95 })

      expect(res).toEqual({
        id: "r-1",
        confidenceWeight: 0.95,
      } as unknown as never)
    })

    it("deletes detector rule", async () => {
      mockRuleDelete.mockResolvedValueOnce({ id: "r-1" } as unknown as never)

      const res = await deleteDetectorRule("r-1")

      expect(res).toEqual({ id: "r-1" } as unknown as never)
    })
  })

  describe("DetectorRuntimeMapping CRUD", () => {
    it("lists runtime mappings", async () => {
      mockMappingFindMany.mockResolvedValueOnce([
        { id: "m-1", runtimeId: "nodejs", runtimeVersion: "20" },
      ] as unknown as never)

      const res = await listRuntimeMappings({ includeInactive: true })

      expect(res).toHaveLength(1)
      expect(mockMappingFindMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ frameworkId: "asc" }, { priority: "desc" }],
      })
    })

    it("gets runtime mapping by id", async () => {
      mockMappingFindUnique.mockResolvedValueOnce({
        id: "m-1",
      } as unknown as never)

      const res = await getRuntimeMappingById("m-1")

      expect(res).toEqual({ id: "m-1" } as unknown as never)
    })

    it("creates runtime mapping", async () => {
      mockMappingCreate.mockResolvedValueOnce({
        id: "m-new",
        runtimeId: "bun",
      } as unknown as never)

      const res = await createRuntimeMapping({
        frameworkId: "elysia",
        runtimeId: "bun",
        runtimeVersion: "1.0",
      })

      expect(res).toEqual({ id: "m-new", runtimeId: "bun" } as unknown as never)
    })

    it("updates and deletes runtime mapping", async () => {
      mockMappingUpdate.mockResolvedValueOnce({
        id: "m-1",
        runtimeId: "bun",
      } as unknown as never)
      mockMappingDelete.mockResolvedValueOnce({
        id: "m-1",
      } as unknown as never)

      const updated = await updateRuntimeMapping("m-1", { runtimeId: "bun" })
      const deleted = await deleteRuntimeMapping("m-1")

      expect(updated.id).toBe("m-1")
      expect(deleted.id).toBe("m-1")
    })
  })

  describe("Inspection Logs and Recommendations", () => {
    it("lists inspection logs with pagination", async () => {
      mockLogFindMany.mockResolvedValueOnce([
        { id: "log-1", source: "github" },
      ] as unknown as never)
      mockLogCount.mockResolvedValueOnce(1)

      const res = await listInspectionLogs({ limit: 10, offset: 0 })

      expect(res.logs).toHaveLength(1)
      expect(res.total).toBe(1)
    })

    it("gets inspection log by id", async () => {
      mockLogFindUnique.mockResolvedValueOnce({
        id: "log-1",
      } as unknown as never)

      const res = await getInspectionLogById("log-1")

      expect(res).toEqual({ id: "log-1" } as unknown as never)
    })

    it("generates rule recommendations from inspection logs", async () => {
      mockLogFindMany.mockResolvedValueOnce([
        {
          id: "log-1",
          treeJson: { files: ["nuxt.config.ts"] },
          frameworksJson: { detected: ["nuxt"] },
          executionMs: 120,
        },
      ] as unknown as never)
      mockRuleFindMany.mockResolvedValueOnce([] as unknown as never)

      const recommendations = await generateRuleRecommendations()

      expect(Array.isArray(recommendations)).toBe(true)
    })
  })
})
