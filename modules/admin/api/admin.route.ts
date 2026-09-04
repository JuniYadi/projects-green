import { Elysia } from "elysia"

import { createAdminOrganizationsRoutes } from "@/modules/admin/api/routes/admin-organizations.route"
import { createAdminInvitationsRoutes } from "@/modules/admin/api/routes/admin-invitations.route"
import {
  createAdminDevicesRoutes,
  createAdminWhatsappDevicesRoutes,
} from "@/modules/whatsapp/devices/api/admin-devices.route"
import { createAdminWebhooksRoutes } from "@/modules/whatsapp/webhooks/api/admin-webhooks.route"
import { createAdminMetaAppsRoutes } from "@/modules/whatsapp/meta-apps/api/meta-apps.route"
import { detectorAdminRoutes } from "@/modules/framework-detection/api/detector-admin.route"
import { createAdminAppHostingClusterRoutes } from "@/modules/admin/api/routes/admin-app-hosting-clusters.route"
import { createAdminWhatsappOrganizationApiKeyRoutes } from "@/modules/whatsapp/organization-api-keys/api/organization-api-keys.route"
import { createWhatsappAuditRoutes } from "@/modules/whatsapp/audit/api/whatsapp-audit.route"
import { createAdminAiRoutes } from "@/modules/docs/api/admin-ai.route"
import { createAdminCronRoutes } from "@/modules/admin/api/routes/admin-cron.route"
import { createManagedStockRoutes } from "@/modules/deploy/api/routes/app-managed-stock.route"
import { createAdminRegionsRoutes } from "@/modules/billing/api/admin/regions.route"
import { createAdminDeploymentsRoutes } from "@/modules/admin/api/routes/admin-deployments.route"

export const adminRoutes = new Elysia()
  .use(createAdminOrganizationsRoutes())
  .use(createAdminInvitationsRoutes())
  .use(createAdminDevicesRoutes())
  .use(createAdminWhatsappDevicesRoutes())
  .use(createAdminWebhooksRoutes())
  .use(createAdminMetaAppsRoutes())
  .use(createAdminWhatsappOrganizationApiKeyRoutes())
  .use(createWhatsappAuditRoutes())
  .use(detectorAdminRoutes)
  .use(createAdminAppHostingClusterRoutes())
  .use(createAdminAiRoutes())
  .use(createAdminCronRoutes())
  .use(createManagedStockRoutes())
  .use(createAdminRegionsRoutes())
  .use(createAdminDeploymentsRoutes())
