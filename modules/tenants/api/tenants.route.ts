import { Elysia } from "elysia"

import { tenantsAuthorizationRoutes } from "@/modules/tenants/api/routes/tenants-authorization.route"
import { tenantsBootstrapRoutes } from "@/modules/tenants/api/routes/tenants-bootstrap.route"
import { tenantsInvitationRoutes } from "@/modules/tenants/api/routes/tenants-invitations.route"
import { tenantsMembershipRoutes } from "@/modules/tenants/api/routes/tenants-memberships.route"
import { tenantsOrganizationRoutes } from "@/modules/tenants/api/routes/tenants-organization.route"
import { tenantsOwnershipRoutes } from "@/modules/tenants/api/routes/tenants-ownership.route"

export const tenantsRoutes = new Elysia()
  .use(tenantsBootstrapRoutes)
  .use(tenantsAuthorizationRoutes)
  .use(tenantsMembershipRoutes)
  .use(tenantsInvitationRoutes)
  .use(tenantsOrganizationRoutes)
  .use(tenantsOwnershipRoutes)
