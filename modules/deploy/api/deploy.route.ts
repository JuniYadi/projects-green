import { Elysia } from "elysia"

import { billingGateRoutes } from "@/modules/deploy/api/routes/billing-gate.route"
import { deployPipelineRoutes } from "@/modules/deploy/api/routes/deploy-pipeline.route"
import { deployTriggerRoutes } from "@/modules/deploy/api/routes/deploy-trigger.route"
import { environmentVariablesRoutes } from "@/modules/deploy/api/routes/environment-variables.route"
import { monitoringRoutes } from "@/modules/deploy/api/routes/monitoring.route"
import { opensearchLogsRoutes } from "@/modules/deploy/api/routes/opensearch-logs.route"

export const deployRoutes = new Elysia()
  .use(deployTriggerRoutes)
  .use(billingGateRoutes)
  .use(deployPipelineRoutes)
  .use(environmentVariablesRoutes)
  .use(monitoringRoutes)
  .use(opensearchLogsRoutes)
