import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import { resolveAuthContext } from "@/lib/auth/resolve-proxy-auth"
import { toWhatsappContactDTO } from "../contacts.dto"

const contactBodySchema = t.Object({
  phoneNumber: t.String(),
  name: t.String(),
  email: t.String(),
  contactGroupId: t.Optional(t.String()),
  status: t.Optional(t.Enum({ ACTIVE: "ACTIVE", INACTIVE: "INACTIVE" })),
  whatsappDeviceId: t.Optional(t.String()),
  dynamicValues: t.Optional(t.Any()),
  dynamicRaw: t.Optional(t.String()),
})

const contactUpdateSchema = t.Partial(contactBodySchema)

const DEFAULT_CONTACT_GROUP_NAME = "Ungrouped"
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

// Resolve a usable contact group id for an organization. When the caller does
// not provide one, fall back to (or lazily create) a default "Ungrouped" group
// so contacts can be added without a dedicated Groups UI (WhatsApp MVP).
async function resolveContactGroupId(
  organizationId: string,
  requestedGroupId?: string
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  if (requestedGroupId) {
    const group = await prisma.whatsappContactGroup.findFirst({
      where: { id: requestedGroupId, organizationId },
    })
    if (!group) {
      return {
        ok: false,
        message: "Contact group not found or access denied.",
      }
    }
    return { ok: true, id: group.id }
  }

  const existingDefault = await prisma.whatsappContactGroup.findFirst({
    where: { organizationId, name: DEFAULT_CONTACT_GROUP_NAME },
  })
  if (existingDefault) {
    return { ok: true, id: existingDefault.id }
  }

  const created = await prisma.whatsappContactGroup.create({
    data: {
      organizationId,
      name: DEFAULT_CONTACT_GROUP_NAME,
      description: "Default audience for ungrouped contacts.",
    },
  })
  return { ok: true, id: created.id }
}

export const contactsRoutes = new Elysia({ prefix: "/contacts" })
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
      const data = contacts.map(toWhatsappContactDTO)
      return {
        ok: true,
        contacts: data,
        data,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      }
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
      const resolvedGroup = await resolveContactGroupId(
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

      return { ok: true, contact: toWhatsappContactDTO(contact) }
    },
    {
      body: contactBodySchema,
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
      body: contactUpdateSchema,
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
    }
  )
