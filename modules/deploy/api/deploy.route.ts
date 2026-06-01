import { Elysia } from "elysia"

import { environmentVariablesRoutes } from "@/modules/deploy/api/routes/environment-variables.route"
import { monitoringRoutes } from "@/modules/deploy/api/routes/monitoring.route"

export const deployRoutes = new Elysia()
  .use(environmentVariablesRoutes)
  .use(monitoringRoutes)
