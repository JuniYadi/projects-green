import { Elysia } from "elysia"

import { createAdminOrganizationsRoutes } from "@/modules/admin/api/routes/admin-organizations.route"
import { createAdminInvitationsRoutes } from "@/modules/admin/api/routes/admin-invitations.route"

export const adminRoutes = new Elysia()
  .use(createAdminOrganizationsRoutes())
  .use(createAdminInvitationsRoutes())