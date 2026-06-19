import { Elysia } from "elysia"
import { z } from "zod"
import { Prisma } from "@prisma/client"

import {
  requireSuperAdmin,
  type AdminApiError,
} from "@/modules/admin/api/admin.guards"
import * as detectorAdminService from "@/modules/framework-detection/detector-admin.service"
import {
  toDetectorRuleDTO,
  toRuntimeMappingDTO,
  toInspectionLogDTO,
} from "@/modules/framework-detection/framework-detection.dto"

// --- Schemas ---

const createDetectorRuleSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
  patternJson: z.record(z.string(), z.unknown()),
  implicationsJson: z.record(z.string(), z.unknown()),
  confidenceWeight: z.number().min(0).max(1).optional(),
  priority: z.number().int().optional(),
})

const updateDetectorRuleSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  patternJson: z.record(z.string(), z.unknown()).optional(),
  implicationsJson: z.record(z.string(), z.unknown()).optional(),
  confidenceWeight: z.number().min(0).max(1).optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().optional(),
})

const createRuntimeMappingSchema = z.object({
  frameworkId: z.string().trim().min(1).max(100),
  frameworkVersion: z.string().trim().max(50).optional(),
  runtimeId: z.string().trim().min(1).max(50),
  runtimeVersion: z.string().trim().min(1).max(50),
  buildVersion: z.string().trim().max(50).optional(),
  priority: z.number().int().optional(),
})

const updateRuntimeMappingSchema = z.object({
  frameworkId: z.string().trim().min(1).max(100).optional(),
  frameworkVersion: z.string().trim().max(50).nullable().optional(),
  runtimeId: z.string().trim().min(1).max(50).optional(),
  runtimeVersion: z.string().trim().min(1).max(50).optional(),
  buildVersion: z.string().trim().max(50).nullable().optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().optional(),
})

const listLogsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  status: z.string().trim().optional(),
  repoUrl: z.string().trim().optional(),
  framework: z.string().trim().optional(),
})

// --- Dependency types ---

export type DetectorAdminDependencies = {
  requireSuperAdmin?: typeof requireSuperAdmin
  listDetectorRules?: typeof detectorAdminService.listDetectorRules
  getDetectorRuleById?: typeof detectorAdminService.getDetectorRuleById
  createDetectorRule?: typeof detectorAdminService.createDetectorRule
  updateDetectorRule?: typeof detectorAdminService.updateDetectorRule
  deleteDetectorRule?: typeof detectorAdminService.deleteDetectorRule
  listRuntimeMappings?: typeof detectorAdminService.listRuntimeMappings
  getRuntimeMappingById?: typeof detectorAdminService.getRuntimeMappingById
  createRuntimeMapping?: typeof detectorAdminService.createRuntimeMapping
  updateRuntimeMapping?: typeof detectorAdminService.updateRuntimeMapping
  deleteRuntimeMapping?: typeof detectorAdminService.deleteRuntimeMapping
  listInspectionLogs?: typeof detectorAdminService.listInspectionLogs
  getInspectionLogById?: typeof detectorAdminService.getInspectionLogById
  generateRuleRecommendations?: typeof detectorAdminService.generateRuleRecommendations
}

// --- Routes ---

export const createDetectorAdminRoutes = (
  deps: DetectorAdminDependencies = {}
) => {
  const guard = deps.requireSuperAdmin ?? requireSuperAdmin
  const listRules =
    deps.listDetectorRules ?? detectorAdminService.listDetectorRules
  const getRuleById =
    deps.getDetectorRuleById ?? detectorAdminService.getDetectorRuleById
  const createRule =
    deps.createDetectorRule ?? detectorAdminService.createDetectorRule
  const updateRule =
    deps.updateDetectorRule ?? detectorAdminService.updateDetectorRule
  const deleteRule =
    deps.deleteDetectorRule ?? detectorAdminService.deleteDetectorRule
  const listMappings =
    deps.listRuntimeMappings ?? detectorAdminService.listRuntimeMappings
  const getMappingById =
    deps.getRuntimeMappingById ?? detectorAdminService.getRuntimeMappingById
  const createMapping =
    deps.createRuntimeMapping ?? detectorAdminService.createRuntimeMapping
  const updateMapping =
    deps.updateRuntimeMapping ?? detectorAdminService.updateRuntimeMapping
  const deleteMapping =
    deps.deleteRuntimeMapping ?? detectorAdminService.deleteRuntimeMapping
  const listLogs =
    deps.listInspectionLogs ?? detectorAdminService.listInspectionLogs
  const getLogById =
    deps.getInspectionLogById ?? detectorAdminService.getInspectionLogById
  const recommend =
    deps.generateRuleRecommendations ??
    detectorAdminService.generateRuleRecommendations

  return (
    new Elysia()
      // === DetectorRule CRUD ===
      .get(
        "/admin/detector/rules",
        async ({ query, set }) => {
          const actor = await guard(set)
          if ("ok" in actor && !actor.ok) {
            return actor as AdminApiError
          }

          const includeInactive = query.includeInactive === "true"
          const rules = await listRules({ includeInactive })

          return {
            ok: true as const,
            data: rules.map(toDetectorRuleDTO),
          }
        },
        {
          query: z.object({
            includeInactive: z.string().optional(),
          }),
        }
      )
      .get("/admin/detector/rules/:id", async ({ params, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) {
          return actor as AdminApiError
        }

        const rule = await getRuleById(params.id)

        if (!rule) {
          set.status = 404
          return {
            ok: false as const,
            error: "NOT_FOUND" as const,
            message: "Detector rule not found.",
          }
        }

        return { ok: true as const, data: toDetectorRuleDTO(rule) }
      })
      .post(
        "/admin/detector/rules",
        async ({ body, set }) => {
          const actor = await guard(set)
          if ("ok" in actor && !actor.ok) {
            return actor as AdminApiError
          }

          const parsed = createDetectorRuleSchema.safeParse(body)

          if (!parsed.success) {
            set.status = 400
            return {
              ok: false as const,
              error: "INVALID_PAYLOAD" as const,
              message: "Invalid detector rule payload.",
              fieldErrors: z.flattenError(parsed.error).fieldErrors,
            }
          }

          const rule = await createRule(parsed.data)

          set.status = 201
          return { ok: true as const, data: toDetectorRuleDTO(rule) }
        },
        { body: createDetectorRuleSchema }
      )
      .patch(
        "/admin/detector/rules/:id",
        async ({ params, body, set }) => {
          const actor = await guard(set)
          if ("ok" in actor && !actor.ok) {
            return actor as AdminApiError
          }

          const parsed = updateDetectorRuleSchema.safeParse(body)

          if (!parsed.success) {
            set.status = 400
            return {
              ok: false as const,
              error: "INVALID_PAYLOAD" as const,
              message: "Invalid update payload.",
              fieldErrors: z.flattenError(parsed.error).fieldErrors,
            }
          }

          const existing = await getRuleById(params.id)

          if (!existing) {
            set.status = 404
            return {
              ok: false as const,
              error: "NOT_FOUND" as const,
              message: "Detector rule not found.",
            }
          }

          const rule = await updateRule(params.id, parsed.data)

          return { ok: true as const, data: toDetectorRuleDTO(rule) }
        },
        { body: updateDetectorRuleSchema }
      )
      .delete("/admin/detector/rules/:id", async ({ params, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) {
          return actor as AdminApiError
        }

        const existing = await getRuleById(params.id)

        if (!existing) {
          set.status = 404
          return {
            ok: false as const,
            error: "NOT_FOUND" as const,
            message: "Detector rule not found.",
          }
        }

        await deleteRule(params.id)

        return { ok: true as const, data: toDetectorRuleDTO(existing) }
      })
      // === RuntimeMapping CRUD ===
      .get(
        "/admin/detector/mappings",
        async ({ query, set }) => {
          const actor = await guard(set)
          if ("ok" in actor && !actor.ok) {
            return actor as AdminApiError
          }

          const includeInactive = query.includeInactive === "true"
          const mappings = await listMappings({ includeInactive })

          return {
            ok: true as const,
            data: mappings.map(toRuntimeMappingDTO),
          }
        },
        {
          query: z.object({
            includeInactive: z.string().optional(),
          }),
        }
      )
      .get("/admin/detector/mappings/:id", async ({ params, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) {
          return actor as AdminApiError
        }

        const mapping = await getMappingById(params.id)

        if (!mapping) {
          set.status = 404
          return {
            ok: false as const,
            error: "NOT_FOUND" as const,
            message: "Runtime mapping not found.",
          }
        }

        return { ok: true as const, data: toRuntimeMappingDTO(mapping) }
      })
      .post(
        "/admin/detector/mappings",
        async ({ body, set }) => {
          const actor = await guard(set)
          if ("ok" in actor && !actor.ok) {
            return actor as AdminApiError
          }

          const parsed = createRuntimeMappingSchema.safeParse(body)

          if (!parsed.success) {
            set.status = 400
            return {
              ok: false as const,
              error: "INVALID_PAYLOAD" as const,
              message: "Invalid runtime mapping payload.",
              fieldErrors: z.flattenError(parsed.error).fieldErrors,
            }
          }

          try {
            const mapping = await createMapping(parsed.data)

            set.status = 201
            return { ok: true as const, data: toRuntimeMappingDTO(mapping) }
          } catch (error) {
            // Handle unique constraint violation
            if (
              error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === "P2002"
            ) {
              set.status = 409
              return {
                ok: false as const,
                error: "DUPLICATE" as const,
                message:
                  "A mapping for this framework version and runtime already exists.",
              }
            }
            throw error
          }
        },
        { body: createRuntimeMappingSchema }
      )
      .patch(
        "/admin/detector/mappings/:id",
        async ({ params, body, set }) => {
          const actor = await guard(set)
          if ("ok" in actor && !actor.ok) {
            return actor as AdminApiError
          }

          const parsed = updateRuntimeMappingSchema.safeParse(body)

          if (!parsed.success) {
            set.status = 400
            return {
              ok: false as const,
              error: "INVALID_PAYLOAD" as const,
              message: "Invalid update payload.",
              fieldErrors: z.flattenError(parsed.error).fieldErrors,
            }
          }

          const existing = await getMappingById(params.id)

          if (!existing) {
            set.status = 404
            return {
              ok: false as const,
              error: "NOT_FOUND" as const,
              message: "Runtime mapping not found.",
            }
          }

          const mapping = await updateMapping(params.id, parsed.data)

          return { ok: true as const, data: toRuntimeMappingDTO(mapping) }
        },
        { body: updateRuntimeMappingSchema }
      )
      .delete("/admin/detector/mappings/:id", async ({ params, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) {
          return actor as AdminApiError
        }

        const existing = await getMappingById(params.id)

        if (!existing) {
          set.status = 404
          return {
            ok: false as const,
            error: "NOT_FOUND" as const,
            message: "Runtime mapping not found.",
          }
        }

        await deleteMapping(params.id)

        return { ok: true as const, data: toRuntimeMappingDTO(existing) }
      })
      // === Inspection Logs ===
      .get(
        "/admin/detector/logs",
        async ({ query, set }) => {
          const actor = await guard(set)
          if ("ok" in actor && !actor.ok) {
            return actor as AdminApiError
          }

          const result = await listLogs({
            limit: query.limit,
            offset: query.offset,
            status: query.status,
            repoUrl: query.repoUrl,
            framework: query.framework,
          })

          return {
            ok: true as const,
            data: {
              logs: result.logs.map(toInspectionLogDTO),
              total: result.total,
            },
          }
        },
        { query: listLogsQuerySchema }
      )
      .get("/admin/detector/logs/:id", async ({ params, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) {
          return actor as AdminApiError
        }

        const log = await getLogById(params.id)

        if (!log) {
          set.status = 404
          return {
            ok: false as const,
            error: "NOT_FOUND" as const,
            message: "Inspection log not found.",
          }
        }

        return { ok: true as const, data: toInspectionLogDTO(log) }
      })
      // === AI Recommendations ===
      .post("/admin/detector/recommend", async ({ set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) {
          return actor as AdminApiError
        }

        const recommendations = await recommend()

        return { ok: true as const, data: recommendations }
      })
  )
}

export const detectorAdminRoutes = createDetectorAdminRoutes()
