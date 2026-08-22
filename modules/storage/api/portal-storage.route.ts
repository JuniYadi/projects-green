import { Elysia } from "elysia"
import { StorageService } from "../storage.service"
import { resolveAuthContext } from "@/lib/auth/resolve-proxy-auth"
import { getPlatformRoleForUser } from "@/lib/platform-role"

export const portalStorageRoutes = new Elysia({ prefix: "/portal/storage" })
  .derive(async ({ request, set }) => {
    const auth = await resolveAuthContext(request)
    if (!auth || auth.type !== "workos") {
      set.status = 401
      throw new Error("Unauthorized: Authentication required")
    }

    const role = await getPlatformRoleForUser({
      id: auth.userId,
      email: auth.email,
    })
    if (role !== "super_admin") {
      set.status = 403
      throw new Error("Forbidden: Super Admin platform role required")
    }

    return { auth }
  })
  /**
   * GET /api/portal/storage/metrics
   */
  .get("/metrics", async () => {
    return await StorageService.getAdminMetrics()
  })
  /**
   * GET /api/portal/storage/files
   */
  .get("/files", async ({ query }) => {
    const page = query.page ? Number(query.page) : 1
    const pageSize = query.pageSize ? Number(query.pageSize) : 20
    const search = query.search as string | undefined
    const organizationId = query.organizationId as string | undefined
    const uploadedByUserId = query.uploadedByUserId as string | undefined
    const purpose = query.purpose as string | undefined
    const status = query.status as "PENDING" | "ACTIVE" | "DELETED" | undefined
    const startDate = query.startDate
      ? new Date(query.startDate as string)
      : undefined
    const endDate = query.endDate
      ? new Date(query.endDate as string)
      : undefined

    return await StorageService.listAdminFiles({
      page,
      pageSize,
      search,
      organizationId,
      uploadedByUserId,
      purpose,
      status,
      startDate,
      endDate,
    })
  })
  /**
   * GET /api/portal/storage/files/:id/view-url
   */
  .get("/files/:id/view-url", async ({ params, set }) => {
    try {
      return await StorageService.getAdminViewUrl(params.id)
    } catch (err: unknown) {
      set.status = 404
      const msg = err instanceof Error ? err.message : String(err)
      return { error: msg }
    }
  })
  /**
   * DELETE /api/portal/storage/files/:id
   */
  .delete("/files/:id", async ({ params, set }) => {
    try {
      return await StorageService.forceDeleteFile(params.id)
    } catch (err: unknown) {
      set.status = 404
      const msg = err instanceof Error ? err.message : String(err)
      return { error: msg }
    }
  })
