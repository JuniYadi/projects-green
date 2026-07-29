import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { prisma } from "@/lib/prisma"
import { getDeploymentPods } from "../../pod-status.service"

/**
 * GET /api/deploy/pods/:deployId
 *
 * Returns live pod detail (name, phase, ready counts, restart count,
 * latest warning event) for a deployment. Returns `[]` when the cluster
 * integration lacks the direct Kubernetes HTTP credentials needed to
 * call the Kubernetes API, keeping platform secrets off tenant-facing
 * paths.
 */
export const podStatusRoutes = new Elysia({ prefix: "/deploy" }).get(
  "/pods/:deployId",
  async ({ params, set }) => {
    const auth = await withAuth()
    if (!auth.user) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
    }

    const deployment = await prisma.applicationDeployment.findUnique({
      where: { id: params.deployId },
      select: { id: true, organizationId: true },
    })

    if (!deployment) {
      set.status = 404
      return {
        ok: false,
        error: "NOT_FOUND",
        message: "Deployment not found",
      }
    }

    if (deployment.organizationId !== auth.organizationId) {
      set.status = 403
      return {
        ok: false,
        error: "FORBIDDEN",
        message: "Deployment belongs to a different organization",
      }
    }

    const pods = await getDeploymentPods(params.deployId)
    return { ok: true, data: pods }
  }
)
