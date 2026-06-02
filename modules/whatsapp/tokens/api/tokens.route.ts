import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import { resolveAuthContext } from "@/lib/auth/resolve-proxy-auth"

const tokenBodySchema = t.Object({
  name: t.String(),
  key: t.String(),
  environment: t.Enum({ SANDBOX: "SANDBOX", LIVE: "LIVE" }),
})

const tokenUpdateSchema = t.Partial(tokenBodySchema)

export const tokensRoutes = new Elysia({ prefix: "/tokens" })
  .get("/", async ({ request }: { request: any }) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) {
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }
    const tokens = await prisma.whatsappApiKey.findMany({
      where: whatsappAuth.type === "workos" && whatsappAuth.platformRole !== "super_admin" 
        ? { organizationId: whatsappAuth.organizationId! } 
        : {},
      orderBy: { createdAt: "desc" },
    })
    return { ok: true, tokens }
  })
  .get("/:id", async ({ request, params: { id }, set }: { request: any, params: { id: string }, set: any }) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }
    const token = await prisma.whatsappApiKey.findUnique({
      where: { id },
    })

    if (!token) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Token not found." }
    }

    return { ok: true, token }
  })
  .post("/", async ({ request, body, set }: { request: any, body: any, set: any }) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }
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
  }, {
    body: tokenBodySchema
  })
  .patch("/:id", async ({ request, params: { id }, body, set }: { request: any, params: { id: string }, body: any, set: any }) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }
    const token = await prisma.whatsappApiKey.findUnique({
      where: { id },
    })

    if (!token) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Token not found." }
    }

    const updated = await prisma.whatsappApiKey.update({
      where: { id },
      data: body,
    })

    return { ok: true, token: updated }
  }, {
    body: tokenUpdateSchema
  })
  .delete("/:id", async ({ request, params: { id }, set }: { request: any, params: { id: string }, set: any }) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }
    await prisma.whatsappApiKey.delete({
      where: { id },
    })
    return { ok: true, message: "Token deleted." }
  })
