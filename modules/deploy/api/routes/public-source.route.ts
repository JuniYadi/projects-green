import { Elysia, t } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { prisma } from "@/lib/prisma"
import { checkPublicSourceUpdate } from "../../public-source.service"

export const publicSourceRoutes = new Elysia({
  prefix: "/deploy/public-source",
}).post(
  "/:stackId/check",
  async ({ params, set }) => {
    const auth = await withAuth()
    if (!auth.user || !auth.organizationId) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
    }
    const stack = await prisma.applicationStack.findFirst({
      where: {
        id: params.stackId,
        organizationId: auth.organizationId,
        sourceType: "PUBLIC",
      },
      include: { deployments: { orderBy: { createdAt: "desc" }, take: 1 } },
    })
    if (!stack?.publicSourceUrl) {
      set.status = 404
      return {
        ok: false,
        error: "PUBLIC_SOURCE_NOT_FOUND",
        message: "Public source not found",
      }
    }
    try {
      const result = await checkPublicSourceUpdate({
        url: stack.publicSourceUrl,
        ref: stack.publicSourceRef ?? stack.branchName,
        deployedSha: stack.deployments[0]?.commitSha,
      })
      return { ok: true, data: result }
    } catch {
      set.status = 502
      return {
        ok: false,
        error: "PUBLIC_SOURCE_CHECK_FAILED",
        message: "Unable to check public source",
      }
    }
  },
  { params: t.Object({ stackId: t.String() }) }
)
