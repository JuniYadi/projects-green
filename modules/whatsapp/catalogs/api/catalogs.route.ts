import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import { resolveAuthContext } from "@/lib/auth/resolve-proxy-auth"
import { catalogService } from "../catalogs.service"
import { toWhatsappCatalogDTO, toWhatsappCatalogProductDTO } from "../catalogs.dto"
import { logWhatsappAuditEvent } from "@/modules/whatsapp/audit/whatsapp-audit.service"

const createCatalogSchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
  metaCatalogId: t.String({ minLength: 1 }),
  deviceId: t.Optional(t.String()),
})

const updateCatalogSchema = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
  metaCatalogId: t.Optional(t.String({ minLength: 1 })),
  deviceId: t.Optional(t.Nullable(t.String())),
})

const sendCatalogSchema = t.Object({
  to: t.String({ minLength: 1 }),
  catalogId: t.String({ minLength: 1 }),
  type: t.Union([t.Literal("product"), t.Literal("product_list"), t.Literal("catalog_message")]),
  productRetailerId: t.Optional(t.String()),
  body: t.Optional(t.String()),
  header: t.Optional(t.String()),
  footer: t.Optional(t.String()),
  sections: t.Optional(
    t.Array(
      t.Object({
        title: t.String({ maxLength: 24 }),
        productItems: t.Array(t.String()),
      })
    )
  ),
  thumbnailProductRetailerId: t.Optional(t.String()),
})

export const catalogsRoutes = new Elysia({ prefix: "/catalogs" })
  .get(
    "/",
    async ({ request, set }: { request: any; set: any }) => {
      const auth = await resolveAuthContext(request)
      if (!auth) { set.status = 401; return { ok: false, error: "UNAUTHORIZED", message: "Auth required." } }
      const catalogs = await catalogService.list(auth.organizationId!)
      return { ok: true, data: catalogs.map(toWhatsappCatalogDTO) }
    }
  )
  .post(
    "/",
    async ({ request, body, set }: { request: any; body: any; set: any }) => {
      const auth = await resolveAuthContext(request)
      if (!auth) { set.status = 401; return { ok: false, error: "UNAUTHORIZED", message: "Auth required." } }
      const catalog = await catalogService.create({ ...body, organizationId: auth.organizationId! })
      return { ok: true, data: toWhatsappCatalogDTO(catalog) }
    },
    { body: createCatalogSchema }
  )
  .get(
    "/:id",
    async ({ request, params: { id }, set }: { request: any; params: { id: string }; set: any }) => {
      const auth = await resolveAuthContext(request)
      if (!auth) { set.status = 401; return { ok: false, error: "UNAUTHORIZED", message: "Auth required." } }
      const catalog = await catalogService.findById(id, auth.organizationId!)
      if (!catalog) { set.status = 404; return { ok: false, error: "NOT_FOUND", message: "Catalog not found." } }
      return { ok: true, data: toWhatsappCatalogDTO(catalog) }
    }
  )
  .patch(
    "/:id",
    async ({ request, params: { id }, body, set }: { request: any; params: { id: string }; body: any; set: any }) => {
      const auth = await resolveAuthContext(request)
      if (!auth) { set.status = 401; return { ok: false, error: "UNAUTHORIZED", message: "Auth required." } }
      try {
        const catalog = await catalogService.update(id, auth.organizationId!, body)
        return { ok: true, data: toWhatsappCatalogDTO(catalog) }
      } catch {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Catalog not found." }
      }
    },
    { body: updateCatalogSchema }
  )
  .delete(
    "/:id",
    async ({ request, params: { id }, set }: { request: any; params: { id: string }; set: any }) => {
      const auth = await resolveAuthContext(request)
      if (!auth) { set.status = 401; return { ok: false, error: "UNAUTHORIZED", message: "Auth required." } }
      const result = await catalogService.delete(id, auth.organizationId!)
      if (!result) { set.status = 404; return { ok: false, error: "NOT_FOUND", message: "Catalog not found." } }
      return { ok: true, message: "Catalog deleted." }
    }
  )
  .get(
    "/:catalogId/products",
    async ({ request, params: { catalogId }, set }: { request: any; params: { catalogId: string }; set: any }) => {
      const auth = await resolveAuthContext(request)
      if (!auth) { set.status = 401; return { ok: false, error: "UNAUTHORIZED", message: "Auth required." } }
      const products = await catalogService.listProducts(catalogId, auth.organizationId!)
      if (products === null) { set.status = 404; return { ok: false, error: "NOT_FOUND", message: "Catalog not found." } }
      return { ok: true, data: products.map(toWhatsappCatalogProductDTO) }
    }
  )
  .post(
    "/:catalogId/sync",
    async ({ request, params: { catalogId }, set }: { request: any; params: { catalogId: string }; set: any }) => {
      const auth = await resolveAuthContext(request)
      if (!auth) { set.status = 401; return { ok: false, error: "UNAUTHORIZED", message: "Auth required." } }
      // Find device token for Meta API call
      const catalog = await prisma.whatsappCatalog.findFirst({
        where: { id: catalogId, organizationId: auth.organizationId! },
        include: { device: true },
      })
      if (!catalog) { set.status = 404; return { ok: false, error: "NOT_FOUND", message: "Catalog not found." } }
      const token = catalog.device?.tokenEncrypted
      if (!token) { set.status = 400; return { ok: false, error: "NO_DEVICE_TOKEN", message: "Catalog has no device with token." } }
      // ponytail: decrypt token same as device client
      const { decryptWhatsAppToken } = await import("@/lib/whatsapp/crypto")
      const decrypted = await decryptWhatsAppToken(token)
      const result = await catalogService.syncFromMeta(catalogId, auth.organizationId!, decrypted)
      logWhatsappAuditEvent({
        action: "CATALOG_SYNCED",
        organizationId: auth.organizationId!,
        deviceId: catalog.deviceId ?? undefined,
        adminId: (auth as any).userId,
        message: `Synced catalog ${catalog.name}`,
        details: { catalogId, synced: result?.synced },
      })
      return { ok: true, data: result }
    }
  )
  .post(
    "/send",
    async ({ request, body, set }: { request: any; body: any; set: any }) => {
      const auth = await resolveAuthContext(request)
      if (!auth) { set.status = 401; return { ok: false, error: "UNAUTHORIZED", message: "Auth required." } }
      const { to, catalogId, type, productRetailerId, body: bodyText, header, footer, sections, thumbnailProductRetailerId } = body as any
      // Verify catalog belongs to org
      const catalog = await prisma.whatsappCatalog.findFirst({
        where: { id: catalogId, organizationId: auth.organizationId! },
      })
      if (!catalog) { set.status = 404; return { ok: false, error: "NOT_FOUND", message: "Catalog not found." } }
      // Resolve device (catalog's device or org's default)
      const device = catalog.deviceId
        ? await prisma.whatsappDevice.findFirst({ where: { id: catalog.deviceId!, organizationId: auth.organizationId! } })
        : await prisma.whatsappDevice.findFirst({ where: { organizationId: auth.organizationId! } })
      if (!device?.tokenEncrypted) { set.status = 400; return { ok: false, error: "NO_DEVICE", message: "No WhatsApp device configured." } }
      const { decryptWhatsAppToken } = await import("@/lib/whatsapp/crypto")
      const { WhatsAppDeviceClient } = await import("@/lib/whatsapp/meta-cloud/device-client")
      const token = await decryptWhatsAppToken(device.tokenEncrypted)
      const client = new WhatsAppDeviceClient({
        accessToken: token,
        phoneNumberId: device.whatsappPhoneId ?? "",
        wabaId: device.whatsappBusinessAccountId ?? "",
        organizationId: auth.organizationId,
      })
      let result
      switch (type) {
        case "product":
          if (!productRetailerId) { set.status = 422; return { ok: false, error: "VALIDATION_ERROR", message: "productRetailerId required for product type." } }
          result = await client.sendSingleProduct(to, catalog.metaCatalogId, productRetailerId, bodyText ? { text: bodyText } : undefined)
          break
        case "product_list":
          if (!sections?.length) { set.status = 422; return { ok: false, error: "VALIDATION_ERROR", message: "sections required for product_list type." } }
          result = await client.sendMultiProductList(to, catalog.metaCatalogId, sections, header ? { text: header } : undefined, bodyText ? { text: bodyText } : undefined, footer ? { text: footer } : undefined)
          break
        case "catalog_message":
          result = await client.sendCatalogMessage(to, catalog.metaCatalogId, thumbnailProductRetailerId, bodyText ? { text: bodyText } : undefined)
          break
        default:
          set.status = 422
          return { ok: false, error: "VALIDATION_ERROR", message: "Invalid type." }
      }
      logWhatsappAuditEvent({
        action: "CATALOG_MESSAGE_SENT",
        organizationId: auth.organizationId!,
        deviceId: device.id,
        adminId: (auth as any).userId,
        message: `Catalog ${type} message sent to ${to}`,
        details: { catalogId, type, waMessageId: result.providerMessageId },
      })
      return { ok: true, data: { providerMessageId: result.providerMessageId } }
    },
    { body: sendCatalogSchema }
  )
