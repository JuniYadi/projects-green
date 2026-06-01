import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import {
  whatsappAuthPlugin,
  guardOrgRead,
  guardOrgWrite,
  guardOrgFull,
} from "@/lib/whatsapp/auth"

const groupBodySchema = t.Object({
  name: t.String({ maxLength: 100 }),
  description: t.String({ maxLength: 500 }),
  type: t.Optional(t.Enum({ STATIC: "STATIC", DYNAMIC: "DYNAMIC" })),
  status: t.Optional(t.Enum({ ACTIVE: "ACTIVE", INACTIVE: "INACTIVE" })),
  throttleMaxMessages: t.Optional(t.Nullable(t.Number())),
  throttlePerMinutes: t.Optional(t.Nullable(t.Number())),
  whatsappDeviceId: t.Optional(t.Nullable(t.String())),
})

const groupUpdateSchema = t.Partial(groupBodySchema)

export const groupsRoutes = new Elysia({ prefix: "/groups" })
  .use(whatsappAuthPlugin)
  .get("/", guardOrgRead(async ({ whatsappAuth, query }: { whatsappAuth: any, query: any }) => {
    const { status, type, name } = query as any
    
    const where: any = {
      organizationId: whatsappAuth.organizationId,
    }

    if (status) where.status = status
    if (type) where.type = type
    if (name) where.name = { contains: name, mode: "insensitive" }

    const groups = await prisma.whatsappContactGroup.findMany({
      where,
      orderBy: { createdAt: "desc" },
    })
    return { ok: true, groups }
  }))
  .get("/:id", guardOrgRead(async ({ params: { id }, whatsappAuth, set }: { params: { id: string }, whatsappAuth: any, set: any }) => {
    const group = await prisma.whatsappContactGroup.findFirst({
      where: { 
        id,
        organizationId: whatsappAuth.organizationId
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
  }))
  .post("/", guardOrgWrite(async ({ body, whatsappAuth, set }: { body: any, whatsappAuth: any, set: any }) => {
    if (!whatsappAuth.organizationId) {
      set.status = 400
      return { ok: false, error: "BAD_REQUEST", message: "Organization ID required." }
    }

    const group = await prisma.whatsappContactGroup.create({
      data: {
        ...body,
        organizationId: whatsappAuth.organizationId,
      },
    })

    return { ok: true, group }
  }), {
    body: groupBodySchema
  })
  .patch("/:id", guardOrgWrite(async ({ params: { id }, body, whatsappAuth, set }: { params: { id: string }, body: any, whatsappAuth: any, set: any }) => {
    const group = await prisma.whatsappContactGroup.findFirst({
      where: { 
        id,
        organizationId: whatsappAuth.organizationId
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
  }), {
    body: groupUpdateSchema
  })
  .delete("/:id", guardOrgFull(async ({ params: { id }, whatsappAuth, set }: { params: { id: string }, whatsappAuth: any, set: any }) => {
    const group = await prisma.whatsappContactGroup.findFirst({
      where: { 
        id,
        organizationId: whatsappAuth.organizationId
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
  }))
