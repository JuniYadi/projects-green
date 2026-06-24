import { Elysia } from "elysia"

import { createAdminOrganizationsRoutes } from "@/modules/admin/api/routes/admin-organizations.route"
import { createAdminInvitationsRoutes } from "@/modules/admin/api/routes/admin-invitations.route"
import { createAdminDevicesRoutes } from "@/modules/whatsapp/devices/api/admin-devices.route"
import { createAdminWebhooksRoutes } from "@/modules/whatsapp/webhooks/api/admin-webhooks.route"
import { detectorAdminRoutes } from "@/modules/framework-detection/api/detector-admin.route"

export const adminRoutes = new Elysia()
  .use(createAdminOrganizationsRoutes())
  .use(createAdminInvitationsRoutes())
  .use(createAdminDevicesRoutes())
  .use(createAdminWebhooksRoutes())
  .use(detectorAdminRoutes)
