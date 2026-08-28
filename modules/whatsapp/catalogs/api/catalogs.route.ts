import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import { resolveAuthContext } from "@/lib/auth/resolve-proxy-auth"
import { resolveOrgRole } from "@/lib/auth/org-role"
import { catalogService } from "../catalogs.service"
import {
  toWhatsappCatalogDTO,
  toWhatsappCatalogProductDTO,
} from "../catalogs.dto"
import { logWhatsappAuditEvent } from "@/modules/whatsapp/audit/whatsapp-audit.service"

const createCatalogSchema = t.Object({
  name: t.String({
    minLength: 1,
    maxLength: 100,
    example: "Katalog Produk Elektronik",
    description: "Display name for the catalog",
  }),
  metaCatalogId: t.String({
    minLength: 1,
    example: "meta_cat_1234567890",
    description: "Meta Commerce Manager Catalog ID",
  }),
  deviceId: t.Optional(
    t.String({
      example: "dev_clt1234567890",
      description:
        "Connected WhatsApp device ID used to dispatch catalog products",
    })
  ),
})

const updateCatalogSchema = t.Object({
  name: t.Optional(
    t.String({
      minLength: 1,
      maxLength: 100,
      example: "Katalog Produk Elektronik Updated",
      description: "Updated display name for the catalog",
    })
  ),
  metaCatalogId: t.Optional(
    t.String({
      minLength: 1,
      example: "meta_cat_1234567890",
      description: "Updated Meta Commerce Manager Catalog ID",
    })
  ),
  deviceId: t.Optional(
    t.Nullable(
      t.String({
        example: "dev_clt1234567890",
        description: "Updated device ID",
      })
    )
  ),
})

const sendCatalogSchema = t.Object({
  to: t.String({
    minLength: 1,
    example: "+6281234567890",
    description: "Recipient phone number in E.164 format",
  }),
  catalogId: t.String({
    minLength: 1,
    example: "cat_clt1234567890",
    description: "WhatsApp catalog ID",
  }),
  type: t.Union(
    [
      t.Literal("product"),
      t.Literal("product_list"),
      t.Literal("catalog_message"),
    ],
    {
      example: "product",
      description: "Type of catalog message",
    }
  ),
  productRetailerId: t.Optional(
    t.String({
      example: "SKU-IPHONE-15",
      description: "Retailer SKU ID for single product message",
    })
  ),
  body: t.Optional(
    t.String({
      example: "Halo, silakan cek produk unggulan kami!",
      description: "Message body text",
    })
  ),
  header: t.Optional(
    t.String({
      example: "Produk Terbaru",
      description: "Header title text",
    })
  ),
  footer: t.Optional(
    t.String({
      example: "PT Maju Bersama",
      description: "Footer text",
    })
  ),
  sections: t.Optional(
    t.Array(
      t.Object({
        title: t.String({
          maxLength: 24,
          example: "Smartphone",
        }),
        productItems: t.Array(
          t.String({
            minLength: 1,
            example: "SKU-IPHONE-15",
          })
        ),
      }),
      {
        minItems: 1,
        example: [
          {
            title: "Smartphone",
            productItems: ["SKU-IPHONE-15", "SKU-SAMSUNG-S24"],
          },
        ],
      }
    )
  ),
  thumbnailProductRetailerId: t.Optional(
    t.String({
      example: "SKU-IPHONE-15",
      description: "Featured product thumbnail retailer ID",
    })
  ),
})

export const catalogsRoutes = new Elysia({
  prefix: "/catalogs",
  detail: {
    tags: ["WhatsApp Catalogs"],
  },
})
  .get(
    "/",
    async ({ request, set }: { request: any; set: any }) => {
      const auth = await resolveAuthContext(request)
      if (!auth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      const catalogs = await catalogService.list(auth.organizationId!)
      return { ok: true, data: catalogs.map(toWhatsappCatalogDTO) }
    },
    {
      detail: {
        summary: "List WhatsApp Catalogs",
        description:
          "Retrieves all synced Meta Commerce Catalogs for the authenticated organization.",
        tags: ["WhatsApp Catalogs"],
      },
    }
  )
  .post(
    "/",
    async ({ request, body, set }: { request: any; body: any; set: any }) => {
      const auth = await resolveAuthContext(request)
      if (!auth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      if (auth.type !== "workos") {
        set.status = 403
        return {
          ok: false,
          error: "FORBIDDEN",
          message: "Admin role required.",
        }
      }
      if (!auth.organizationId) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "No organization." }
      }
      const { userId, organizationId, orgRole } = auth as {
        userId: string
        organizationId: string
        orgRole: string | null
      }
      const role = orgRole ?? (await resolveOrgRole(userId, organizationId))
      if (!role || !["owner", "admin"].includes(role)) {
        set.status = 403
        return {
          ok: false,
          error: "FORBIDDEN",
          message: "Admin role required.",
        }
      }
      const catalog = await catalogService.create({
        ...body,
        organizationId: auth.organizationId,
      })
      return { ok: true, data: toWhatsappCatalogDTO(catalog) }
    },
    {
      body: createCatalogSchema,
      detail: {
        summary: "Create WhatsApp Catalog",
        description:
          "Links a Meta Commerce Manager Catalog ID with an active WhatsApp device.",
        tags: ["WhatsApp Catalogs"],
      },
    }
  )
  .get(
    "/:id",
    async ({
      request,
      params: { id },
      set,
    }: {
      request: any
      params: { id: string }
      set: any
    }) => {
      const auth = await resolveAuthContext(request)
      if (!auth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      const catalog = await catalogService.findById(id, auth.organizationId!)
      if (!catalog) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Catalog not found." }
      }
      return { ok: true, data: toWhatsappCatalogDTO(catalog) }
    },
    {
      params: t.Object({
        id: t.String({
          example: "cat_clt1234567890",
          description: "WhatsApp catalog unique ID",
        }),
      }),
      detail: {
        summary: "Get WhatsApp Catalog Details",
        description:
          "Fetches details of a specific catalog including connected device and Meta catalog ID.",
        tags: ["WhatsApp Catalogs"],
      },
    }
  )
  .patch(
    "/:id",
    async ({
      request,
      params: { id },
      body,
      set,
    }: {
      request: any
      params: { id: string }
      body: any
      set: any
    }) => {
      const auth = await resolveAuthContext(request)
      if (!auth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      if (auth.type !== "workos") {
        set.status = 403
        return {
          ok: false,
          error: "FORBIDDEN",
          message: "Admin role required.",
        }
      }
      if (!auth.organizationId) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "No organization." }
      }
      const { userId, organizationId, orgRole } = auth as {
        userId: string
        organizationId: string
        orgRole: string | null
      }
      const role = orgRole ?? (await resolveOrgRole(userId, organizationId))
      if (!role || !["owner", "admin"].includes(role)) {
        set.status = 403
        return {
          ok: false,
          error: "FORBIDDEN",
          message: "Admin role required.",
        }
      }
      try {
        const catalog = await catalogService.update(
          id,
          auth.organizationId,
          body
        )
        return { ok: true, data: toWhatsappCatalogDTO(catalog) }
      } catch {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Catalog not found." }
      }
    },
    {
      params: t.Object({
        id: t.String({
          example: "cat_clt1234567890",
          description: "WhatsApp catalog unique ID",
        }),
      }),
      body: updateCatalogSchema,
      detail: {
        summary: "Update WhatsApp Catalog",
        description:
          "Updates catalog name, Meta catalog ID, or linked device assignment.",
        tags: ["WhatsApp Catalogs"],
      },
    }
  )
  .delete(
    "/:id",
    async ({
      request,
      params: { id },
      set,
    }: {
      request: any
      params: { id: string }
      set: any
    }) => {
      const auth = await resolveAuthContext(request)
      if (!auth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      if (auth.type !== "workos") {
        set.status = 403
        return {
          ok: false,
          error: "FORBIDDEN",
          message: "Admin role required.",
        }
      }
      if (!auth.organizationId) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "No organization." }
      }
      const { userId, organizationId, orgRole } = auth as {
        userId: string
        organizationId: string
        orgRole: string | null
      }
      const role = orgRole ?? (await resolveOrgRole(userId, organizationId))
      if (!role || !["owner", "admin"].includes(role)) {
        set.status = 403
        return {
          ok: false,
          error: "FORBIDDEN",
          message: "Admin role required.",
        }
      }
      const result = await catalogService.delete(id, auth.organizationId)
      if (!result) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Catalog not found." }
      }
      return { ok: true, message: "Catalog deleted." }
    },
    {
      params: t.Object({
        id: t.String({
          example: "cat_clt1234567890",
          description: "WhatsApp catalog unique ID",
        }),
      }),
      detail: {
        summary: "Delete WhatsApp Catalog",
        description: "Unlinks and deletes a WhatsApp catalog entry.",
        tags: ["WhatsApp Catalogs"],
      },
    }
  )
  .get(
    "/:id/products",
    async ({
      request,
      params: { id },
      set,
    }: {
      request: any
      params: { id: string }
      set: any
    }) => {
      const auth = await resolveAuthContext(request)
      if (!auth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      const products = await catalogService.listProducts(
        id,
        auth.organizationId!
      )
      if (products === null) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Catalog not found." }
      }
      return { ok: true, data: products.map(toWhatsappCatalogProductDTO) }
    },
    {
      params: t.Object({
        id: t.String({
          example: "cat_clt1234567890",
          description: "WhatsApp catalog unique ID",
        }),
      }),
      detail: {
        summary: "List Catalog Products",
        description:
          "Fetches synced product SKU items belonging to this catalog.",
        tags: ["WhatsApp Catalogs"],
      },
    }
  )
  .post(
    "/:id/sync",
    async ({
      request,
      params: { id },
      set,
    }: {
      request: any
      params: { id: string }
      set: any
    }) => {
      const auth = await resolveAuthContext(request)
      if (!auth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      if (auth.type !== "workos") {
        set.status = 403
        return {
          ok: false,
          error: "FORBIDDEN",
          message: "Admin role required.",
        }
      }
      if (!auth.organizationId) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "No organization." }
      }
      const { userId, organizationId, orgRole } = auth as {
        userId: string
        organizationId: string
        orgRole: string | null
      }
      const role = orgRole ?? (await resolveOrgRole(userId, organizationId))
      if (!role || !["owner", "admin"].includes(role)) {
        set.status = 403
        return {
          ok: false,
          error: "FORBIDDEN",
          message: "Admin role required.",
        }
      }
      // Find device token for Meta API call
      const catalog = await prisma.whatsappCatalog.findFirst({
        where: { id, organizationId: auth.organizationId },
        include: { device: true },
      })
      if (!catalog) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Catalog not found." }
      }
      const token = catalog.device?.tokenEncrypted
      if (!token) {
        set.status = 400
        return {
          ok: false,
          error: "NO_DEVICE_TOKEN",
          message: "Catalog has no device with token.",
        }
      }
      // ponytail: decrypt token same as device client
      const { decryptWhatsAppToken } = await import("@/lib/whatsapp/crypto")
      const decrypted = await decryptWhatsAppToken(token)
      const result = await catalogService.syncFromMeta(
        id,
        auth.organizationId!,
        decrypted
      )
      logWhatsappAuditEvent({
        action: "CATALOG_SYNCED",
        organizationId: auth.organizationId!,
        deviceId: catalog.deviceId ?? undefined,
        adminId: (auth as any).userId,
        message: `Synced catalog ${catalog.name}`,
        details: { catalogId: id, synced: result?.synced },
      })
      return { ok: true, data: result }
    },
    {
      params: t.Object({
        id: t.String({
          example: "cat_clt1234567890",
          description: "WhatsApp catalog unique ID",
        }),
      }),
      detail: {
        summary: "Sync Products from Meta",
        description:
          "Synchronizes product items and inventory directly from Meta Commerce Manager.",
        tags: ["WhatsApp Catalogs"],
      },
    }
  )
  .post(
    "/send",
    async ({ request, body, set }: { request: any; body: any; set: any }) => {
      const auth = await resolveAuthContext(request)
      if (!auth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      if (auth.type !== "workos") {
        set.status = 403
        return {
          ok: false,
          error: "FORBIDDEN",
          message: "Admin role required.",
        }
      }
      if (!auth.organizationId) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "No organization." }
      }
      const { userId, organizationId, orgRole } = auth as {
        userId: string
        organizationId: string
        orgRole: string | null
      }
      const role = orgRole ?? (await resolveOrgRole(userId, organizationId))
      if (!role || !["owner", "admin"].includes(role)) {
        set.status = 403
        return {
          ok: false,
          error: "FORBIDDEN",
          message: "Admin role required.",
        }
      }
      const {
        to,
        catalogId,
        type,
        productRetailerId,
        body: bodyText,
        header,
        footer,
        sections,
        thumbnailProductRetailerId,
      } = body as any
      // Verify catalog belongs to org
      const catalog = await prisma.whatsappCatalog.findFirst({
        where: { id: catalogId, organizationId: auth.organizationId! },
      })
      if (!catalog) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Catalog not found." }
      }
      // Resolve device (catalog's device or org's default)
      const device = catalog.deviceId
        ? await prisma.whatsappDevice.findFirst({
            where: {
              id: catalog.deviceId!,
              organizationId: auth.organizationId!,
            },
          })
        : await prisma.whatsappDevice.findFirst({
            where: { organizationId: auth.organizationId! },
          })
      if (!device?.tokenEncrypted) {
        set.status = 400
        return {
          ok: false,
          error: "NO_DEVICE",
          message: "No WhatsApp device configured.",
        }
      }
      const { decryptWhatsAppToken } = await import("@/lib/whatsapp/crypto")
      const { WhatsAppDeviceClient } =
        await import("@/lib/whatsapp/meta-cloud/device-client")
      const token = await decryptWhatsAppToken(device.tokenEncrypted)
      const client = new WhatsAppDeviceClient({
        accessToken: token,
        phoneNumberId: device.whatsappPhoneId ?? "",
        wabaId: device.whatsappBusinessAccountId ?? "",
        organizationId: auth.organizationId ?? undefined,
      })
      let result
      switch (type) {
        case "product":
          if (!productRetailerId) {
            set.status = 422
            return {
              ok: false,
              error: "VALIDATION_ERROR",
              message: "productRetailerId required for product type.",
            }
          }
          result = await client.sendSingleProduct(
            to,
            catalog.metaCatalogId,
            productRetailerId,
            bodyText ? { text: bodyText } : undefined
          )
          break
        case "product_list":
          if (!sections?.length) {
            set.status = 422
            return {
              ok: false,
              error: "VALIDATION_ERROR",
              message: "sections required for product_list type.",
            }
          }
          result = await client.sendMultiProductList(
            to,
            catalog.metaCatalogId,
            sections,
            header ? { text: header } : undefined,
            bodyText ? { text: bodyText } : undefined,
            footer ? { text: footer } : undefined
          )
          break
        case "catalog_message":
          result = await client.sendCatalogMessage(
            to,
            catalog.metaCatalogId,
            thumbnailProductRetailerId,
            bodyText ? { text: bodyText } : undefined
          )
          break
        default:
          set.status = 422
          return {
            ok: false,
            error: "VALIDATION_ERROR",
            message: "Invalid type.",
          }
      }
      logWhatsappAuditEvent({
        action: "CATALOG_MESSAGE_SENT",
        organizationId: auth.organizationId!,
        deviceId: device.id,
        adminId: (auth as any).userId,
        message: `Catalog ${type} message sent to ${to}`,
        details: { catalogId, type, waMessageId: result.providerMessageId },
      })
      return { ok: true, data: result }
    },
    {
      detail: {
        summary: "Send Interactive Catalog / Product Message",
        description:
          "Dispatches a single product card, product list, or whole catalog message to a WhatsApp user.",
        tags: ["WhatsApp Catalogs"],
      },
    }
  )
