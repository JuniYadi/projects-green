import { prisma } from "@/lib/prisma"

export type CreateCatalogInput = {
  organizationId: string
  name: string
  metaCatalogId: string
  deviceId?: string
}

export type UpdateCatalogInput = {
  name?: string
  metaCatalogId?: string
  deviceId?: string | null
}

export const catalogService = {
  async create(input: CreateCatalogInput) {
    return prisma.whatsappCatalog.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        metaCatalogId: input.metaCatalogId,
        deviceId: input.deviceId,
      },
      include: { _count: { select: { products: true } } },
    })
  },

  async findById(id: string, organizationId: string) {
    return prisma.whatsappCatalog.findFirst({
      where: { id, organizationId },
      include: { _count: { select: { products: true } } },
    })
  },

  async list(organizationId: string) {
    return prisma.whatsappCatalog.findMany({
      where: { organizationId },
      include: { _count: { select: { products: true } } },
      orderBy: { createdAt: "desc" },
    })
  },

  async update(id: string, organizationId: string, input: UpdateCatalogInput) {
    return prisma.whatsappCatalog.update({
      where: { id, organizationId },
      data: input,
      include: { _count: { select: { products: true } } },
    })
  },

  async delete(id: string, organizationId: string) {
    const catalog = await prisma.whatsappCatalog.findFirst({
      where: { id, organizationId },
    })
    if (!catalog) return null
    await prisma.whatsappCatalog.delete({ where: { id, organizationId } })
    return catalog
  },

  async listProducts(catalogId: string, organizationId: string) {
    const catalog = await prisma.whatsappCatalog.findFirst({
      where: { id: catalogId, organizationId },
    })
    if (!catalog) return null
    return prisma.whatsappCatalogProduct.findMany({
      where: { catalogId },
      orderBy: { name: "asc" },
    })
  },

  // ponytail: manual sync only; add webhook listener if real-time needed
  async syncFromMeta(
    catalogId: string,
    organizationId: string,
    accessToken: string
  ) {
    const catalog = await prisma.whatsappCatalog.findFirst({
      where: { id: catalogId, organizationId },
    })
    if (!catalog) return null

    // Fetch products from Meta Commerce Manager
    const baseUrl = `https://graph.facebook.com/v25.0/${catalog.metaCatalogId}/products`
    const params = new URLSearchParams({
      fields: "id,retailer_id,name,description,price,currency,url,images",
      limit: "100",
    })

    let after: string | undefined
    let synced = 0
    while (true) {
      const url = after
        ? `${baseUrl}?${params}&after=${after}`
        : `${baseUrl}?${params}`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(
          `Meta API error: ${err.error?.message ?? res.statusText}`
        )
      }
      const data = await res.json()

      for (const product of data.data ?? []) {
        const imageUrl = product.images?.data?.[0]?.url ?? null
        await prisma.whatsappCatalogProduct.upsert({
          where: {
            catalogId_productRetailerId: {
              catalogId: catalog.id,
              productRetailerId: product.retailer_id,
            },
          },
          update: {
            name: product.name,
            description: product.description,
            price: product.price,
            currency: product.currency,
            url: product.url,
            imageUrl,
          },
          create: {
            catalogId: catalog.id,
            productRetailerId: product.retailer_id,
            name: product.name,
            description: product.description,
            price: product.price,
            currency: product.currency,
            url: product.url,
            imageUrl,
          },
        })
        synced++
      }

      after = data.paging?.cursors?.after
      if (!after || !data.data?.length) break
    }

    return { synced, catalogId: catalog.id }
  },
}
