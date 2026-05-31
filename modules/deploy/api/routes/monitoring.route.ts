import { Elysia, t } from "elysia"

import {
  DEPLOY_LOG_LINES,
  DEPLOY_TIMELINE,
} from "@/modules/deploy/deploy.mock"

export const monitoringRoutes = new Elysia({ prefix: "/deploy" })
  .get(
    "/logs/:deployId",
    () => {
      return {
        ok: true as const,
        data: DEPLOY_LOG_LINES,
      }
    },
    {
      params: t.Object({
        deployId: t.String(),
      }),
    }
  )
  .get(
    "/events/:deployId",
    () => {
      return {
        ok: true as const,
        data: DEPLOY_TIMELINE,
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
    () => {
      return {
        ok: true as const,
        data: {
          status: "building",
          attempt: 1,
        },
      }
    },
    {
      params: t.Object({
        deployId: t.String(),
      }),
    }
  )
