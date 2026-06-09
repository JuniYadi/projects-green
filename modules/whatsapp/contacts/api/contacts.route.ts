import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import { resolveAuthContext } from "@/lib/auth/resolve-proxy-auth"

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

// Resolve a usable contact group id for an organization. When the caller does
// not provide one, fall back to (or lazily create) a default "Ungrouped" group
// so contacts can be added without a dedicated Groups UI (WhatsApp MVP).
async function resolveContactGroupId(
  organizationId: string,
  requestedGroupId?: string,
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
  .get("/", async ({ request, set, query }: { request: any, set: any, query: any }) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }
    const { contactGroupId, status, phoneNumber } = query as any
    
    const where: any = {
      organizationId: whatsappAuth.organizationId!,
    }

    if (contactGroupId) where.contactGroupId = contactGroupId
    if (status) where.status = status
    if (phoneNumber) where.phoneNumber = { contains: phoneNumber }

    const contacts = await prisma.whatsappContact.findMany({
      where,
      orderBy: { createdAt: "desc" },
    })
    return { ok: true, contacts }
  })
  .get("/:id", async ({ request, params: { id }, set }: { request: any, params: { id: string }, set: any }) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }
    const contact = await prisma.whatsappContact.findFirst({
      where: { 
        id,
        organizationId: whatsappAuth.organizationId!
      },
    })

    if (!contact) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Contact not found." }
    }

    return { ok: true, contact }
  })
  .post("/", async ({ request, body, set }: { request: any, body: any, set: any }) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }
    if (!whatsappAuth.organizationId!) {
      set.status = 400
      return { ok: false, error: "BAD_REQUEST", message: "Organization ID required." }
    }

    // Resolve the contact group: use the requested one, or fall back to a
    // lazily-created default "Ungrouped" group so contacts can be created
    // without requiring a Groups UI.
    const resolvedGroup = await resolveContactGroupId(
      whatsappAuth.organizationId!,
      body.contactGroupId,
    )

    if (!resolvedGroup.ok) {
      set.status = 400
      return { ok: false, error: "BAD_REQUEST", message: resolvedGroup.message }
    }

    // Check for duplicate phone number in same org
    const existing = await prisma.whatsappContact.findFirst({
      where: {
        organizationId: whatsappAuth.organizationId!,
        phoneNumber: body.phoneNumber
      }
    })

    if (existing) {
      set.status = 409
      return { ok: false, error: "CONFLICT", message: "Contact with this phone number already exists." }
    }

    const contact = await prisma.whatsappContact.create({
      data: {
        ...body,
        contactGroupId: resolvedGroup.id,
        organizationId: whatsappAuth.organizationId!,
      },
    })

    return { ok: true, contact }
  }, {
    body: contactBodySchema
  })
  .patch("/:id", async ({ request, params: { id }, body, set }: { request: any, params: { id: string }, body: any, set: any }) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }
    const contact = await prisma.whatsappContact.findFirst({
      where: { 
        id,
        organizationId: whatsappAuth.organizationId!
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
              organizationId: whatsappAuth.organizationId!
            }
          })
      
          if (!group) {
            set.status = 400
            return { ok: false, error: "BAD_REQUEST", message: "Contact group not found or access denied." }
          }
    }

    const updated = await prisma.whatsappContact.update({
      where: { id },
      data: body,
    })

    return { ok: true, contact: updated }
  }, {
    body: contactUpdateSchema
  })
  .delete("/:id", async ({ request, params: { id }, set }: { request: any, params: { id: string }, set: any }) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }
    const contact = await prisma.whatsappContact.findFirst({
        where: { 
          id,
          organizationId: whatsappAuth.organizationId!
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
  })
