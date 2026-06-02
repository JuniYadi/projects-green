import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import { resolveAuthContext } from "@/lib/auth/resolve-proxy-auth"

const groupBodySchema = t.Object({
  name: t.String({ maxLength: 100 } as any),
  description: t.String({ maxLength: 500 } as any),
  type: t.Optional(t.Enum({ STATIC: "STATIC", DYNAMIC: "DYNAMIC" })),
  status: t.Optional(t.Enum({ ACTIVE: "ACTIVE", INACTIVE: "INACTIVE" })),
  throttleMaxMessages: t.Optional(t.Nullable(t.Number())),
  throttlePerMinutes: t.Optional(t.Nullable(t.Number())),
  whatsappDeviceId: t.Optional(t.Nullable(t.String())),
})

const groupUpdateSchema = t.Partial(groupBodySchema)

export const groupsRoutes = new Elysia({ prefix: "/groups" })
  .get("/", async ({ request, set, query }: { request: any, set: any, query: any }) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }
    const { status, type, name } = query as any
    
    const where: any = {
      organizationId: whatsappAuth.organizationId!,
    }

    if (status) where.status = status
    if (type) where.type = type
    if (name) where.name = { contains: name, mode: "insensitive" }

    const groups = await prisma.whatsappContactGroup.findMany({
      where,
      orderBy: { createdAt: "desc" },
    })
    return { ok: true, groups }
  })
  .get("/:id", async ({ request, params: { id }, set }: { request: any, params: { id: string }, set: any }) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }
    const group = await prisma.whatsappContactGroup.findFirst({
      where: { 
        id,
        organizationId: whatsappAuth.organizationId!
      },
      include: {
        _count: {
          select: { contacts: true }
        }
      }
    })

    if (!group) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Group not found." }
    }

    return { ok: true, group }
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

    const group = await prisma.whatsappContactGroup.create({
      data: {
        ...body,
        organizationId: whatsappAuth.organizationId!,
      },
    })

    return { ok: true, group }
  }, {
    body: groupBodySchema
  })
  .patch("/:id", async ({ request, params: { id }, body, set }: { request: any, params: { id: string }, body: any, set: any }) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }
    const group = await prisma.whatsappContactGroup.findFirst({
      where: { 
        id,
        organizationId: whatsappAuth.organizationId!
      },
    })

    if (!group) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Group not found." }
    }

    const updated = await prisma.whatsappContactGroup.update({
      where: { id },
      data: body,
    })

    return { ok: true, group: updated }
  }, {
    body: groupUpdateSchema
  })
  .delete("/:id", async ({ request, params: { id }, set }: { request: any, params: { id: string }, set: any }) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }
    const group = await prisma.whatsappContactGroup.findFirst({
      where: { 
        id,
        organizationId: whatsappAuth.organizationId!
      },
    })

    if (!group) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Group not found." }
    }

    // Check if group has contacts
    const contactsCount = await prisma.whatsappContact.count({
      where: { contactGroupId: id }
    })

    if (contactsCount > 0) {
      set.status = 400
      return { ok: false, error: "BAD_REQUEST", message: "Cannot delete group with existing contacts." }
    }

    await prisma.whatsappContactGroup.delete({
      where: { id },
    })
    return { ok: true, message: "Group deleted." }
  })
