import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import { resolveAuthContext } from "@/lib/auth/resolve-proxy-auth"

const contactBodySchema = t.Object({
  phoneNumber: t.String(),
  name: t.String(),
  email: t.String(),
  contactGroupId: t.String(),
  status: t.Optional(t.Enum({ ACTIVE: "ACTIVE", INACTIVE: "INACTIVE" })),
  whatsappDeviceId: t.Optional(t.String()),
  dynamicValues: t.Optional(t.Any()),
  dynamicRaw: t.Optional(t.String()),
})

const contactUpdateSchema = t.Partial(contactBodySchema)

export const contactsRoutes = new Elysia({ prefix: "/contacts" })
  .get("/", async ({ request, query }: { request: any, query: any }) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) {
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

    // Check if group exists and belongs to org
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
