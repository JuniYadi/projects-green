import { Elysia, t } from "elysia"
import { Prisma, WhatsappBillingCategory } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireSuperAdmin } from "@/modules/admin/api/admin.guards"

export const adminWhatsappPricingRoutes = new Elysia({
  prefix: "/admin/whatsapp/pricing",
})
  .get("/rates", async ({ set }) => {
    const guard = await requireSuperAdmin(set)
    if ("ok" in guard && !guard.ok) return guard
    const [quotaRates, basePrices] = await Promise.all([
      prisma.whatsappQuotaCreditRate.findMany({
        orderBy: [{ country: "asc" }, { effectiveFrom: "desc" }],
      }),
      prisma.whatsappBasePrice.findMany({
        orderBy: [{ country: "asc" }, { effectiveFrom: "desc" }],
      }),
    ])

    return {
      ok: true as const,
      quotaRates: quotaRates.map((r) => ({
        id: r.id,
        category: r.category,
        country: r.country,
        quotaCredit: r.quotaCredit.toString(),
        description: r.description,
        effectiveFrom: r.effectiveFrom.toISOString(),
        effectiveTo: r.effectiveTo?.toISOString() ?? null,
        isActive: r.isActive,
        createdAt: r.createdAt.toISOString(),
      })),
      basePrices: basePrices.map((b) => ({
        id: b.id,
        category: b.category,
        country: b.country,
        basePrice: b.basePrice.toString(),
        metaCost: b.metaCost?.toString() ?? null,
        currency: b.currency,
        effectiveFrom: b.effectiveFrom.toISOString(),
        effectiveTo: b.effectiveTo?.toISOString() ?? null,
        isActive: b.isActive,
        createdAt: b.createdAt.toISOString(),
      })),
    }
  })
  .post(
    "/base-price",
    async ({ body, set }) => {
      const guard = await requireSuperAdmin(set)
      if ("ok" in guard && !guard.ok) return guard
      const effectiveFrom = new Date(body.effectiveFrom)
      if (isNaN(effectiveFrom.getTime())) {
        set.status = 400
        return { ok: false as const, error: "Invalid effectiveFrom date" }
      }

      // Deactivate/close previous active base price for same category & country
      await prisma.whatsappBasePrice.updateMany({
        where: {
          category: body.category,
          country: body.country,
          effectiveTo: null,
          effectiveFrom: { lt: effectiveFrom },
        },
        data: { effectiveTo: effectiveFrom },
      })

      const created = await prisma.whatsappBasePrice.create({
        data: {
          category: body.category,
          country: body.country,
          basePrice: new Prisma.Decimal(body.basePrice),
          metaCost: body.metaCost ? new Prisma.Decimal(body.metaCost) : null,
          currency: body.currency ?? "IDR",
          effectiveFrom,
          effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null,
          isActive: true,
        },
      })

      set.status = 201
      return { ok: true as const, data: created }
    },
    {
      body: t.Object({
        category: t.Enum(WhatsappBillingCategory),
        country: t.String({ default: "ID" }),
        basePrice: t.Number(),
        metaCost: t.Optional(t.Number()),
        currency: t.Optional(t.String({ default: "IDR" })),
        effectiveFrom: t.String(),
        effectiveTo: t.Optional(t.String()),
      }),
    }
  )
  .post(
    "/quota-rate",
    async ({ body, set }) => {
      const guard = await requireSuperAdmin(set)
      if ("ok" in guard && !guard.ok) return guard

      const effectiveFrom = new Date(body.effectiveFrom)
      if (isNaN(effectiveFrom.getTime())) {
        set.status = 400
        return { ok: false as const, error: "Invalid effectiveFrom date" }
      }

      await prisma.whatsappQuotaCreditRate.updateMany({
        where: {
          category: body.category,
          country: body.country,
          effectiveTo: null,
          effectiveFrom: { lt: effectiveFrom },
        },
        data: { effectiveTo: effectiveFrom },
      })

      const created = await prisma.whatsappQuotaCreditRate.create({
        data: {
          category: body.category,
          country: body.country,
          quotaCredit: new Prisma.Decimal(body.quotaCredit),
          description: body.description ?? null,
          effectiveFrom,
          effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null,
          isActive: true,
        },
      })

      set.status = 201
      return { ok: true as const, data: created }
    },
    {
      body: t.Object({
        category: t.Enum(WhatsappBillingCategory),
        country: t.String({ default: "ID" }),
        quotaCredit: t.Number(),
        description: t.Optional(t.String()),
        effectiveFrom: t.String(),
        effectiveTo: t.Optional(t.String()),
      }),
    }
  )
