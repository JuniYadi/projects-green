import { Elysia } from "elysia"
import { z } from "zod"

import { requireSuperAdmin } from "@/modules/admin/api/admin.guards"
import {
  getCachedUsers,
  getCachedOrganizations,
} from "@/lib/workos-directory"

const resolveSchema = z.object({
  userIds: z.array(z.string()).optional().default([]),
  orgIds: z.array(z.string()).optional().default([]),
})

export const createWorkOSDirectoryRoutes = () => {
  return new Elysia({ prefix: "/workos-directory" })
    /**
     * POST /api/workos-directory/resolve
     *
     * Batch-resolve WorkOS user/org IDs to human-readable names.
     * Results are cached in Redis (1h TTL).
     *
     * Body:
     *   { userIds?: string[], orgIds?: string[] }
     *
     * Returns:
     *   {
     *     ok: true,
     *     users: Record<string, { id, name, email, avatarUrl }>,
     *     orgs: Record<string, { id, name }>
     *   }
     */
    .post(
      "/resolve",
      async ({ body, set }) => {
        const actor = await requireSuperAdmin(set as { status?: number | string })
        if (!actor.ok) return actor

        const parsed = resolveSchema.safeParse(body)
        if (!parsed.success) {
          set.status = 422
          return {
            ok: false as const,
            error: "VALIDATION_ERROR" as const,
            message: "Please fix the highlighted fields and try again.",
          }
        }

        const { userIds, orgIds } = parsed.data

        const [userMap, orgMap] = await Promise.all([
          userIds.length > 0
            ? getCachedUsers(userIds)
            : Promise.resolve(new Map()),
          orgIds.length > 0
            ? getCachedOrganizations(orgIds)
            : Promise.resolve(new Map()),
        ])

        const users: Record<string, unknown> = {}
        const orgs: Record<string, unknown> = {}

        for (const [id, user] of userMap) {
          users[id] = user
        }
        for (const [id, org] of orgMap) {
          orgs[id] = org
        }

        return {
          ok: true as const,
          users,
          orgs,
        }
      },
      {
        body: resolveSchema,
      }
    )
}

export const workOSDirectoryRoutes = createWorkOSDirectoryRoutes()
