/**
 * WhatsApp module assembly.
 *
 * Composes all 10 WhatsApp sub-feature routes into a single Elysia instance
 * and exports the aggregate as `whatsappRoutes` for mounting in lib/api.ts.
 */

import { Elysia } from "elysia"

import { devicesRoutes } from "@/modules/whatsapp/devices/api/devices.route"
import { businessProfileRoutes } from "@/modules/whatsapp/devices/api/business-profile.route"
import { tokensRoutes } from "@/modules/whatsapp/tokens/api/tokens.route"
import { templatesRoutes } from "@/modules/whatsapp/templates/api/templates.route"
import { contactsRoutes } from "@/modules/whatsapp/contacts/api/contacts.route"
import { groupsRoutes } from "@/modules/whatsapp/groups/api/groups.route"
import { broadcastsRoutes } from "@/modules/whatsapp/broadcasts/api/broadcasts.route"
import { conversationsRoutes } from "@/modules/whatsapp/conversations/api/conversations.route"
import { messagesRoutes } from "@/modules/whatsapp/messages/api/messages.route"
import { webhooksRoutes } from "@/modules/whatsapp/webhooks/api/webhooks.route"
import { usersRoutes } from "@/modules/whatsapp/users/api/users.route"
import { usageRoutes } from "@/modules/whatsapp/usage/api/usage.route"
import { rateLimitRoutes } from "@/modules/whatsapp/rate-limit/api/rate-limit.route"
import { createWhatsappAuditRoutes } from "@/modules/whatsapp/audit/api/whatsapp-audit.route"
import { catalogsRoutes } from "@/modules/whatsapp/catalogs/api/catalogs.route"

export const whatsappRoutes = new Elysia({ prefix: "/whatsapp" })
  .use(devicesRoutes)
  .use(businessProfileRoutes)
  .use(catalogsRoutes)
  .use(tokensRoutes)
  .use(templatesRoutes)
  .use(contactsRoutes)
  .use(groupsRoutes)
  .use(broadcastsRoutes)
  .use(conversationsRoutes)
  .use(messagesRoutes)
  .use(webhooksRoutes)
  .use(usersRoutes)
  .use(usageRoutes)
  .use(rateLimitRoutes)
  .use(createWhatsappAuditRoutes())
