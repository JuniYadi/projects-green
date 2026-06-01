import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import {
  guardOrgRead,
  guardOrgWrite,
  guardOrgFull,
} from "@/lib/whatsapp/auth"

const deviceBodySchema = t.Object({
  name: t.String(),
  phoneNumber: t.String(),
  businessId: t.String(),
  accessToken: t.String(),
  environment: t.Enum({ SANDBOX: "SANDBOX", LIVE: "LIVE" }),
})

const deviceUpdateSchema = t.Partial(deviceBodySchema)

export const devicesRoutes = new Elysia({ prefix: "/devices" })
  .get("/", guardOrgRead(async ({ whatsappAuth, set }: { whatsappAuth: any, set: any }) => {
    const devices = await prisma.whatsappDevice.findMany({
      where: whatsappAuth.platformRole === "super_admin"
        ? {}
        : { organizationId: whatsappAuth.organizationId! },
      orderBy: { createdAt: "desc" },
    })
    return { ok: true, devices }
  }))
  .get("/:id", guardOrgRead(async ({ params: { id }, whatsappAuth, set }: { params: { id: string }, whatsappAuth: any, set: any }) => {
    const device = await prisma.whatsappDevice.findUnique({
      where: { id },
    })

    if (!device) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Device not found." }
    }

    if (whatsappAuth.platformRole !== "super_admin" && device.organizationId !== whatsappAuth.organizationId) {
      set.status = 403
      return { ok: false, error: "FORBIDDEN", message: "Access denied." }
    }

    return { ok: true, device }
  }))
  .post("/", guardOrgWrite(async ({ body, whatsappAuth, set }: { body: any, whatsappAuth: any, set: any }) => {
    if (whatsappAuth.type === "workos" && !whatsappAuth.organizationId) {
      set.status = 400
      return { ok: false, error: "BAD_REQUEST", message: "Organization ID required." }
    }

    const device = await prisma.whatsappDevice.create({
      data: {
        ...body,
        organizationId: whatsappAuth.type === "workos" ? whatsappAuth.organizationId! : (body as any).organizationId,
        status: "DISCONNECTED",
      },
    })

    return { ok: true, device }
  }), {
    body: deviceBodySchema,
  })
  .patch("/:id", guardOrgWrite(async ({ params: { id }, body, whatsappAuth, set }: { params: { id: string }, body: any, whatsappAuth: any, set: any }) => {
    const device = await prisma.whatsappDevice.findUnique({
      where: { id },
    })

    if (!device) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Device not found." }
    }

    if (whatsappAuth.platformRole !== "super_admin" && device.organizationId !== whatsappAuth.organizationId) {
      set.status = 403
      return { ok: false, error: "FORBIDDEN", message: "Access denied." }
    }

    const updated = await prisma.whatsappDevice.update({
      where: { id },
      data: body,
    })

    return { ok: true, device: updated }
  }), {
    body: deviceUpdateSchema
  })
  .delete("/:id", guardOrgFull(async ({ params: { id }, set }: { params: { id: string }, set: any }) => {
    await prisma.whatsappDevice.delete({
      where: { id },
    })
    return { ok: true, message: "Device deleted." }
  }))
  .post("/:id/verify", guardOrgWrite(async ({ params: { id }, whatsappAuth, set }: { params: { id: string }, whatsappAuth: any, set: any }) => {
    const device = await prisma.whatsappDevice.findUnique({
      where: { id },
    })

    if (!device) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Device not found." }
    }

    if (whatsappAuth.platformRole !== "super_admin" && device.organizationId !== whatsappAuth.organizationId) {
      set.status = 403
      return { ok: false, error: "FORBIDDEN", message: "Access denied." }
    }

    // Logic to verify device with Meta API would go here
    // For now, just updating status as a placeholder
    const updated = await prisma.whatsappDevice.update({
      where: { id },
      data: { status: "ACTIVE" },
    })

    return { ok: true, device: updated }
  }))
  .post("/:id/reconnect", guardOrgWrite(async ({ params: { id }, whatsappAuth, set }: { params: { id: string }, whatsappAuth: any, set: any }) => {
    const device = await prisma.whatsappDevice.findUnique({
      where: { id },
    })

    if (!device) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Device not found." }
    }

    if (whatsappAuth.platformRole !== "super_admin" && device.organizationId !== whatsappAuth.organizationId) {
      set.status = 403
      return { ok: false, error: "FORBIDDEN", message: "Access denied." }
    }

    // Logic to reconnect device would go here
    const updated = await prisma.whatsappDevice.update({
      where: { id },
      data: { status: "ACTIVE" },
    })

    return { ok: true, device: updated }
  }))
