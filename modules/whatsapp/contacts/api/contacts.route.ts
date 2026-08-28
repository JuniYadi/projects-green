import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import { Prisma, type WhatsappMessageDirection } from "@prisma/client"
import { resolveAuthContext } from "@/lib/auth/resolve-proxy-auth"
import { toWhatsappContactDTO } from "../contacts.dto"
import { resolveWhatsappContactGroupId } from "../contacts.service"
import { logWhatsappAuditEvent } from "@/modules/whatsapp/audit/whatsapp-audit.service"

const contactBodySchema = t.Object({
  phoneNumber: t.String({
    example: "+6281234567890",
    description: "Contact phone number in E.164 format",
  }),
  name: t.String({
    example: "Budi Santoso",
    description: "Contact full name",
  }),
  email: t.String({
    example: "budi@example.com",
    description: "Contact email address",
  }),
  contactGroupId: t.Optional(
    t.String({
      example: "grp_clt1234567890",
      description:
        "Optional WhatsApp contact group ID (defaults to 'Ungrouped')",
    })
  ),
  status: t.Optional(
    t.Enum(
      { ACTIVE: "ACTIVE", INACTIVE: "INACTIVE" },
      { example: "ACTIVE", description: "Contact status" }
    )
  ),
  whatsappDeviceId: t.Optional(
    t.String({
      example: "dev_clt1234567890",
      description: "Optional primary sender device ID",
    })
  ),
  dynamicValues: t.Optional(
    t.Any({
      example: { company: "PT Maju Bersama", tier: "VIP" },
      description: "Custom metadata / dynamic placeholder key-values",
    })
  ),
  dynamicRaw: t.Optional(t.String()),
})
const contactUpdateSchema = t.Partial(contactBodySchema)

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

function getPagination(query: Record<string, unknown>) {
  const page = Math.max(Number(query.page) || 1, 1)
  const limit = Math.min(
    Math.max(Number(query.limit) || DEFAULT_LIMIT, 1),
    MAX_LIMIT
  )
  return { page, limit, skip: (page - 1) * limit }
}

export const contactsRoutes = new Elysia({
  prefix: "/contacts",
  detail: {
    tags: ["WhatsApp Contacts"],
  },
})
  .get(
    "/",
    async ({ request, set, query }: { request: any; set: any; query: any }) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      const { contactGroupId, status, phoneNumber } = query as any
      const { page, limit, skip } = getPagination(query)

      const where: any = {
        organizationId: whatsappAuth.organizationId!,
      }

      if (contactGroupId) where.contactGroupId = contactGroupId
      if (status) where.status = status
      if (phoneNumber) where.phoneNumber = { contains: phoneNumber }

      const [total, contacts] = await Promise.all([
        prisma.whatsappContact.count({ where }),
        prisma.whatsappContact.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
      ])

      // Enrich with conversation-derived last-message data
      const phoneNumbers = contacts.map((c) => c.phoneNumber)
      const conversationMap = new Map<
        string,
        {
          lastMessage: string | null
          lastMessageAt: Date | null
          lastMessageDirection: WhatsappMessageDirection | null
        }
      >()
      if (phoneNumbers.length > 0) {
        const conversations = await prisma.whatsappConversation.findMany({
          where: {
            organizationId: whatsappAuth.organizationId!,
            contactPhone: { in: phoneNumbers },
          },
          select: {
            contactPhone: true,
            lastMessageAt: true,
            lastDirection: true,
            whatsappMessages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { body: true, messageType: true },
            },
          },
        })
        for (const conv of conversations) {
          const latestMsg = conv.whatsappMessages[0]
          conversationMap.set(conv.contactPhone, {
            lastMessage: latestMsg?.body ?? latestMsg?.messageType ?? null,
            lastMessageAt: conv.lastMessageAt,
            lastMessageDirection: conv.lastDirection,
          })
        }
      }
      const data = contacts.map((c) => {
        const summary = conversationMap.get(c.phoneNumber) ?? null
        return toWhatsappContactDTO(c, summary)
      })
      return {
        ok: true,
        contacts: data,
        data,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      }
    },
    {
      detail: {
        summary: "List WhatsApp Contacts",
        description:
          "Retrieves a paginated list of contacts for the organization, enriched with recent conversation summary.",
        tags: ["WhatsApp Contacts"],
      },
    }
  )
  .get(
    "/:id",
    async ({
      request,
      params: { id },
      set,
    }: {
      request: any
      params: { id: string }
      set: any
    }) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      const contact = await prisma.whatsappContact.findFirst({
        where: {
          id,
          organizationId: whatsappAuth.organizationId!,
        },
      })

      if (!contact) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Contact not found." }
      }

      return { ok: true, contact: toWhatsappContactDTO(contact) }
    },
    {
      params: t.Object({
        id: t.String({
          example: "cnt_clt1234567890",
          description: "WhatsApp contact unique ID",
        }),
      }),
      detail: {
        summary: "Get WhatsApp Contact Details",
        description:
          "Retrieves contact details, group membership, and variable metadata by contact ID.",
        tags: ["WhatsApp Contacts"],
      },
    }
  )
  .post(
    "/",
    async ({ request, body, set }: { request: any; body: any; set: any }) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      if (!whatsappAuth.organizationId!) {
        set.status = 400
        return {
          ok: false,
          error: "BAD_REQUEST",
          message: "Organization ID required.",
        }
      }

      // Resolve the contact group: use the requested one, or fall back to a
      // lazily-created default "Ungrouped" group so contacts can be created
      // without requiring a Groups UI.
      const resolvedGroup = await resolveWhatsappContactGroupId(
        whatsappAuth.organizationId!,
        body.contactGroupId
      )

      if (!resolvedGroup.ok) {
        set.status = 400
        return {
          ok: false,
          error: "BAD_REQUEST",
          message: resolvedGroup.message,
        }
      }

      // Check for duplicate phone number in same org
      const existing = await prisma.whatsappContact.findFirst({
        where: {
          organizationId: whatsappAuth.organizationId!,
          phoneNumber: body.phoneNumber,
        },
      })

      if (existing) {
        set.status = 409
        return {
          ok: false,
          error: "CONFLICT",
          message: "Contact with this phone number already exists.",
        }
      }

      const contact = await prisma.whatsappContact.create({
        data: {
          ...body,
          contactGroupId: resolvedGroup.id,
          organizationId: whatsappAuth.organizationId!,
        },
      })

      logWhatsappAuditEvent({
        action: "CONTACT_IMPORTED",
        organizationId: whatsappAuth.organizationId!,
        adminId: (whatsappAuth as any).userId,
        message: `Contact imported: ${contact.phoneNumber}`,
        status: "OK",
        details: { contactId: contact.id, phoneNumber: contact.phoneNumber },
      })

      return { ok: true, contact: toWhatsappContactDTO(contact) }
    },
    {
      body: contactBodySchema,
      detail: {
        summary: "Create WhatsApp Contact",
        description:
          "Creates a new WhatsApp contact record associated with an organization and contact group.",
        tags: ["WhatsApp Contacts"],
      },
    }
  )
  .patch(
    "/:id",
    async ({
      request,
      params: { id },
      body,
      set,
    }: {
      request: any
      params: { id: string }
      body: any
      set: any
    }) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      const contact = await prisma.whatsappContact.findFirst({
        where: {
          id,
          organizationId: whatsappAuth.organizationId!,
        },
      })

      if (!contact) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Contact not found." }
      }

      if (body.contactGroupId) {
        const group = await prisma.whatsappContactGroup.findFirst({
          where: {
            id: body.contactGroupId,
            organizationId: whatsappAuth.organizationId!,
          },
        })

        if (!group) {
          set.status = 400
          return {
            ok: false,
            error: "BAD_REQUEST",
            message: "Contact group not found or access denied.",
          }
        }
      }

      const updated = await prisma.whatsappContact.update({
        where: { id },
        data: body,
      })

      return { ok: true, contact: toWhatsappContactDTO(updated) }
    },
    {
      params: t.Object({
        id: t.String({
          example: "cnt_clt1234567890",
          description: "WhatsApp contact unique ID",
        }),
      }),
      body: contactUpdateSchema,
      detail: {
        summary: "Update WhatsApp Contact",
        description:
          "Updates contact details, name, email, or contact group assignment.",
        tags: ["WhatsApp Contacts"],
      },
    }
  )
  .delete(
    "/:id",
    async ({
      request,
      params: { id },
      set,
    }: {
      request: any
      params: { id: string }
      set: any
    }) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      const contact = await prisma.whatsappContact.findFirst({
        where: {
          id,
          organizationId: whatsappAuth.organizationId!,
        },
      })

      if (!contact) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Contact not found." }
      }

      await prisma.whatsappContact.delete({
        where: { id },
      })
      return { ok: true, message: "Contact deleted." }
    },
    {
      params: t.Object({
        id: t.String({
          example: "cnt_clt1234567890",
          description: "WhatsApp contact unique ID",
        }),
      }),
      detail: {
        summary: "Delete WhatsApp Contact",
        description: "Removes a contact record from the database.",
        tags: ["WhatsApp Contacts"],
      },
    }
  )
