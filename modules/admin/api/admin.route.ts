import { Elysia } from "elysia"

import { createAdminOrganizationsRoutes } from "@/modules/admin/api/routes/admin-organizations.route"
import { createAdminInvitationsRoutes } from "@/modules/admin/api/routes/admin-invitations.route"
import { createAdminDevicesRoutes } from "@/modules/whatsapp/devices/api/admin-devices.route"
import { createAdminWebhooksRoutes } from "@/modules/whatsapp/webhooks/api/admin-webhooks.route"
import { createAdminMetaAppsRoutes } from "@/modules/whatsapp/meta-apps/api/meta-apps.route"
import { detectorAdminRoutes } from "@/modules/framework-detection/api/detector-admin.route"
import { createAdminAppHostingClusterRoutes } from "@/modules/admin/api/routes/admin-app-hosting-clusters.route"

export const adminRoutes = new Elysia()
  .use(createAdminOrganizationsRoutes())
  .use(createAdminInvitationsRoutes())
  .use(createAdminDevicesRoutes())
  .use(createAdminWebhooksRoutes())
  .use(createAdminMetaAppsRoutes())
  .use(detectorAdminRoutes)
  .use(createAdminAppHostingClusterRoutes())
