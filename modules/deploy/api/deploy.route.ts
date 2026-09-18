import { Elysia } from "elysia"

import { billingGateRoutes } from "@/modules/deploy/api/routes/billing-gate.route"
import { deployPipelineRoutes } from "@/modules/deploy/api/routes/deploy-pipeline.route"
import {
  appStacksRoutes,
  recentSourcesRoutes,
} from "@/modules/deploy/api/routes/app-stacks.route"
import { appHostingEdgeRoutes } from "@/modules/deploy/api/routes/app-hosting-edge.route"
import { aiDeploymentSessionRoutes } from "@/modules/deploy/api/routes/ai-deployment-session.route"
import { aiDeploymentSessionDecisionRoutes } from "@/modules/deploy/api/routes/ai-deployment-session-decisions.route"
import { aiDeploymentSessionChatRoutes } from "@/modules/deploy/api/routes/ai-deployment-session-chat.route"
import { deploySubmitRoutes } from "@/modules/deploy/api/routes/deploy-submit.route"
import { deployTriggerRoutes } from "@/modules/deploy/api/routes/deploy-trigger.route"
import { appSettingsRoutes } from "@/modules/deploy/api/routes/app-settings.route"
import { environmentVariablesRoutes } from "@/modules/deploy/api/routes/environment-variables.route"
import { monitoringRoutes } from "@/modules/deploy/api/routes/monitoring.route"
import { opensearchLogsRoutes } from "@/modules/deploy/api/routes/opensearch-logs.route"
import { deployJenkinsWebhookRoutes } from "@/modules/deploy/api/routes/jenkins-webhook.route"
import { deployJenkinsImageReadyRoutes } from "@/modules/deploy/api/routes/jenkins-image-ready.route"
import { ephemeralGitTokenRoutes } from "@/modules/deploy/api/routes/ephemeral-git-token.route"
import { podStatusRoutes } from "@/modules/deploy/api/routes/pod-status.route"
import { publicSourceRoutes } from "@/modules/deploy/api/routes/public-source.route"
import { appTemplateRoutes } from "@/modules/deploy/api/routes/templates.route"
import { adminTemplateRoutes } from "@/modules/deploy/api/routes/admin-templates.route"
import { appTelemetryRoutes } from "@/modules/deploy/api/routes/app-telemetry.route"
import { appTrafficRoutes } from "@/modules/deploy/api/routes/app-traffic.route"
import { appLogHealthRoutes } from "@/modules/deploy/api/routes/app-log-health.route"
import { defaultClusterRoutes } from "@/modules/deploy/api/routes/default-cluster.route"

export const deployRoutes = new Elysia()
  .use(aiDeploymentSessionRoutes)
  .use(aiDeploymentSessionDecisionRoutes)
  .use(aiDeploymentSessionChatRoutes)
  .use(defaultClusterRoutes)
  .use(recentSourcesRoutes)
  .use(appStacksRoutes)
  .use(deploySubmitRoutes)
  .use(appHostingEdgeRoutes)
  .use(deployTriggerRoutes)
  .use(billingGateRoutes)
  .use(publicSourceRoutes)
  .use(deployPipelineRoutes)
  .use(environmentVariablesRoutes)
  .use(monitoringRoutes)
  .use(appSettingsRoutes)
  .use(opensearchLogsRoutes)
  .use(deployJenkinsWebhookRoutes)
  .use(deployJenkinsImageReadyRoutes)
  .use(ephemeralGitTokenRoutes)
  .use(podStatusRoutes)
  .use(appTemplateRoutes)
  .use(adminTemplateRoutes)
  .use(appTelemetryRoutes)
  .use(appTrafficRoutes)
  .use(appLogHealthRoutes)
