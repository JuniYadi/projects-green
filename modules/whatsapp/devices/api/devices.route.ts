import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import { resolveAuthContext } from "@/lib/auth/resolve-proxy-auth"

const deviceBodySchema = t.Object({
  name: t.String(),
  phoneNumber: t.String(),
  businessId: t.String(),
  accessToken: t.String(),
  environment: t.Enum({ SANDBOX: "SANDBOX", LIVE: "LIVE" }),
})

const deviceUpdateSchema = t.Partial(deviceBodySchema)

export const devicesRoutes = new Elysia({ prefix: "/devices" })
  .get("/", async ({ request, set }: any) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }
    const devices = await prisma.whatsappDevice.findMany({
      where: (whatsappAuth as any).platformRole === "super_admin"
        ? {}
        : { organizationId: whatsappAuth.organizationId! },
      orderBy: { createdAt: "desc" },
    })
    return { ok: true, devices }
  })
  .get("/:id", async ({ request, params: { id }, set }: any) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }
    const device = await prisma.whatsappDevice.findUnique({
      where: { id },
    })

    if (!device) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Device not found." }
    }

    return { ok: true, device }
  })
  .post("/", async ({ request, body, set }: any) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }
    if (!whatsappAuth.organizationId) {
      set.status = 400
      return { ok: false, error: "BAD_REQUEST", message: "Organization ID required." }
    }

    const device = await prisma.whatsappDevice.create({
      data: {
        ...body,
        organizationId: whatsappAuth.organizationId,
        status: "DISCONNECTED",
      },
    })

    return { ok: true, device }
  }, {
    body: deviceBodySchema,
  })
  .patch("/:id", async ({ request, params: { id }, body, set }: any) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }
    const device = await prisma.whatsappDevice.findUnique({
      where: { id },
    })

    if (!device) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Device not found." }
    }

    const updated = await prisma.whatsappDevice.update({
      where: { id },
      data: body,
    })

    return { ok: true, device: updated }
  }, {
    body: deviceUpdateSchema
  })
  .delete("/:id", async ({ request, params: { id }, set }: any) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }
    await prisma.whatsappDevice.delete({
      where: { id },
    })
    return { ok: true, message: "Device deleted." }
  })
  .post("/:id/verify", async ({ request, params: { id }, set }: any) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }
    const device = await prisma.whatsappDevice.findUnique({
      where: { id },
    })

    if (!device) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Device not found." }
    }

    // Logic to verify device with Meta API would go here
    // For now, just updating status as a placeholder
    const updated = await prisma.whatsappDevice.update({
      where: { id },
      data: { status: "ACTIVE" },
    })

    return { ok: true, device: updated }
  })
  .post("/:id/reconnect", async ({ request, params: { id }, set }: any) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }
    const device = await prisma.whatsappDevice.findUnique({
      where: { id },
    })

    if (!device) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Device not found." }
    }

    // Logic to reconnect device would go here
    const updated = await prisma.whatsappDevice.update({
      where: { id },
      data: { status: "ACTIVE" },
    })

    return { ok: true, device: updated }
  })
