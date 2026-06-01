import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import {
  whatsappAuthPlugin,
  guardOrgRead,
  guardOrgWrite,
  guardSuperAdmin,
} from "@/lib/whatsapp/auth"

const tokenBodySchema = t.Object({
  name: t.String(),
  key: t.String(),
  environment: t.Enum({ SANDBOX: "SANDBOX", LIVE: "LIVE" }),
})

const tokenUpdateSchema = t.Partial(tokenBodySchema)

export const tokensRoutes = new Elysia({ prefix: "/tokens" })
  .use(whatsappAuthPlugin)
  .get("/", guardOrgRead(async ({ whatsappAuth }: { whatsappAuth: any }) => {
    const tokens = await prisma.whatsappApiKey.findMany({
      where: whatsappAuth.type === "workos" && whatsappAuth.platformRole !== "super_admin" 
        ? { organizationId: whatsappAuth.organizationId! } 
        : {},
      orderBy: { createdAt: "desc" },
    })
    return { ok: true, tokens }
  }))
  .get("/:id", guardOrgRead(async ({ params: { id }, whatsappAuth, set }: { params: { id: string }, whatsappAuth: any, set: any }) => {
    const token = await prisma.whatsappApiKey.findUnique({
      where: { id },
    })

    if (!token) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Token not found." }
    }

    if (whatsappAuth.type === "workos" && whatsappAuth.platformRole !== "super_admin" && token.organizationId !== whatsappAuth.organizationId) {
      set.status = 403
      return { ok: false, error: "FORBIDDEN", message: "Access denied." }
    }

    return { ok: true, token }
  }))
  .post("/", guardOrgWrite(async ({ body, whatsappAuth, set }: { body: any, whatsappAuth: any, set: any }) => {
    if (whatsappAuth.type === "workos" && !whatsappAuth.organizationId) {
      set.status = 400
      return { ok: false, error: "BAD_REQUEST", message: "Organization ID required." }
    }

    const token = await prisma.whatsappApiKey.create({
      data: {
        ...body,
        organizationId: whatsappAuth.type === "workos" ? whatsappAuth.organizationId! : (body as any).organizationId,
      },
    })

    return { ok: true, token }
  }), {
    body: tokenBodySchema
  })
  .patch("/:id", guardOrgWrite(async ({ params: { id }, body, whatsappAuth, set }: { params: { id: string }, body: any, whatsappAuth: any, set: any }) => {
    const token = await prisma.whatsappApiKey.findUnique({
      where: { id },
    })

    if (!token) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Token not found." }
    }

    if (whatsappAuth.type === "workos" && whatsappAuth.platformRole !== "super_admin" && token.organizationId !== whatsappAuth.organizationId) {
      set.status = 403
      return { ok: false, error: "FORBIDDEN", message: "Access denied." }
    }

    const updated = await prisma.whatsappApiKey.update({
      where: { id },
      data: body,
    })

    return { ok: true, token: updated }
  }), {
    body: tokenUpdateSchema
  })
  .delete("/:id", guardSuperAdmin(async ({ params: { id } }: { params: { id: string } }) => {
    await prisma.whatsappApiKey.delete({
      where: { id },
    })
    return { ok: true, message: "Token deleted." }
  }))
