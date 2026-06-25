import { Prisma } from "@prisma/client"

export type WhatsappCatalogDTO = Pick<
  Prisma.WhatsappCatalogGetPayload<Prisma.WhatsappCatalogDefaultArgs>,
  "id" | "organizationId" | "name" | "metaCatalogId" | "deviceId" | "createdAt" | "updatedAt"
> & {
  productCount?: number
}

export type WhatsappCatalogProductDTO = Pick<
  Prisma.WhatsappCatalogProductGetPayload<Prisma.WhatsappCatalogProductDefaultArgs>,
  "id" | "catalogId" | "productRetailerId" | "name" | "description" | "price" | "currency" | "imageUrl" | "url" | "createdAt"
>

export function toWhatsappCatalogDTO(
  catalog: Prisma.WhatsappCatalogGetPayload<Prisma.WhatsappCatalogDefaultArgs> & { _count?: { products: number } }
): WhatsappCatalogDTO {
  return {
    id: catalog.id,
    organizationId: catalog.organizationId,
    name: catalog.name,
    metaCatalogId: catalog.metaCatalogId,
    deviceId: catalog.deviceId,
    createdAt: catalog.createdAt,
    updatedAt: catalog.updatedAt,
    productCount: catalog._count?.products,
  }
}

export function toWhatsappCatalogProductDTO(
  product: Prisma.WhatsappCatalogProductGetPayload<Prisma.WhatsappCatalogProductDefaultArgs>
): WhatsappCatalogProductDTO {
  return {
    id: product.id,
    catalogId: product.catalogId,
    productRetailerId: product.productRetailerId,
    name: product.name,
    description: product.description,
    price: product.price,
    currency: product.currency,
    imageUrl: product.imageUrl,
    url: product.url,
    createdAt: product.createdAt,
  }
}
