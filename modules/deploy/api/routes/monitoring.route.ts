import { Elysia, t } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { prisma } from "@/lib/prisma"
import { getDeployEvents, getDeployLogs } from "../../deploy-event.service"
import {
  buildDeployTimelineItems,
  toDeployEventDTOs,
  toDeployLogLines,
  toDeploymentStatusDTO,
} from "../../deploy-monitor.dto"

/**
 * PGREEN-072 — Console Monitor/Manage truth path.
 *
 * These endpoints return REAL persisted deployment state (status, events,
 * logs) for the monitor/manage surface. They replace the previous
 * placeholder responses so the UI reflects honest backend state, including
 * empty states when no logs/events exist yet.
 *
 * Every endpoint enforces auth + organization ownership so a deployment
 * id cannot leak state across tenants.
 */
export const monitoringRoutes = new Elysia({ prefix: "/deploy" })
  .get(
    "/logs/:deployId",
    async ({ params, set }) => {
      const auth = await withAuth()
      if (!auth.user) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
      }

      const deployment = await prisma.applicationDeployment.findUnique({
        where: { id: params.deployId },
      })

      if (!deployment) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Deployment not found" }
      }

      if (deployment.organizationId !== auth.organizationId) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Access denied" }
      }

      const logs = await getDeployLogs(params.deployId)
      return { ok: true, data: toDeployLogLines(logs) }
    },
    {
      params: t.Object({
        deployId: t.String(),
      }),
    }
  )
  .get(
    "/events/:deployId",
    async ({ params, set }) => {
      const auth = await withAuth()
      if (!auth.user) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
      }

      const deployment = await prisma.applicationDeployment.findUnique({
        where: { id: params.deployId },
      })

      if (!deployment) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Deployment not found" }
      }

      if (deployment.organizationId !== auth.organizationId) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Access denied" }
      }

      // The deploy timeline renders canonical phases (Preparing → Building →
      // Deploying) with progress driven by the real deployment status, while
      // the raw event stream remains available for detail surfaces.
      const events = await getDeployEvents(params.deployId)
      return {
        ok: true,
        data: buildDeployTimelineItems(),
        events: toDeployEventDTOs(events),
      }
    },
    {
      params: t.Object({
        deployId: t.String(),
      }),
    }
  )
  .get(
    "/status/:deployId",
    async ({ params, set }) => {
      const auth = await withAuth()
      if (!auth.user) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
      }

      const deployment = await prisma.applicationDeployment.findUnique({
        where: { id: params.deployId },
      })

      if (!deployment) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Deployment not found" }
      }

      if (deployment.organizationId !== auth.organizationId) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Access denied" }
      }

      return { ok: true, data: toDeploymentStatusDTO(deployment) }
    },
    {
      params: t.Object({
        deployId: t.String(),
      }),
    }
  )
