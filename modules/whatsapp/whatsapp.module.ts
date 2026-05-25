/**
 * WhatsApp module assembly.
 *
 * Composes all 9 WhatsApp sub-feature routes into a single Elysia instance
 * with the shared whatsappAuthPlugin, then exports the aggregate as
 * `whatsappRoutes` for mounting in lib/api.ts.
 */

import { Elysia } from "elysia"

import { devicesRoutes } from "@/modules/whatsapp/devices/api/devices.route"
import { tokensRoutes } from "@/modules/whatsapp/tokens/api/tokens.route"
import { templatesRoutes } from "@/modules/whatsapp/templates/api/templates.route"
import { contactsRoutes } from "@/modules/whatsapp/contacts/api/contacts.route"
import { groupsRoutes } from "@/modules/whatsapp/groups/api/groups.route"
import { broadcastsRoutes } from "@/modules/whatsapp/broadcasts/api/broadcasts.route"
import { conversationsRoutes } from "@/modules/whatsapp/conversations/api/conversations.route"
import { messagesRoutes } from "@/modules/whatsapp/messages/api/messages.route"
import { webhooksRoutes } from "@/modules/whatsapp/webhooks/api/webhooks.route"

/**
 * Top-level await is required here because whatsappAuthPlugin internally
 * performs a dynamic import of the WorkOS SDK at module-evaluation time.
 * Bun supports top-level await on ESM modules without any extra config.
 */
const { whatsappAuthPlugin } = await import("@/lib/whatsapp/auth")

export const whatsappRoutes = new Elysia({ prefix: "/whatsapp" })
  .use(whatsappAuthPlugin)
  .use(devicesRoutes)
  .use(tokensRoutes)
  .use(templatesRoutes)
  .use(contactsRoutes)
  .use(groupsRoutes)
  .use(broadcastsRoutes)
  .use(conversationsRoutes)
  .use(messagesRoutes)
  .use(webhooksRoutes)
