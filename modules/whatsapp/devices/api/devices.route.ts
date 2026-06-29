import { Elysia } from "elysia"
import { Prisma } from "@prisma/client"
import { withAuth } from "@workos-inc/authkit-nextjs"

import { prisma } from "@/lib/prisma"
import {
  resolveAuthContext,
  type ResolvedAuth,
} from "@/lib/auth/resolve-proxy-auth"
import { resolveOrgRole, type OrgRole } from "@/lib/auth/org-role"
import { enqueueWhatsAppTemplateSync } from "@/lib/queue/whatsapp-template-sync"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import {
  decryptWhatsAppToken,
  encryptWhatsAppToken,
} from "@/lib/whatsapp/crypto"
import { fieldErrorMapFromIssues } from "@/lib/validation"
import { toDeviceDetail, toDeviceListItem } from "../devices.dto"
import { updateDeviceSchema } from "../devices.schemas"
import { checkDeviceHealth } from "@/lib/queue/whatsapp-health"
import { logWhatsappAuditEvent } from "@/modules/whatsapp/audit/whatsapp-audit.service"
import { generateWebhookSigningSecret } from "../devices.service"

type RouteSet = {
  status?: number | string
}

export const isSuperAdmin = (auth: ResolvedAuth) =>
  auth.type === "workos" && auth.platformRole === "super_admin"

const roleFromWorkOSAuth = (auth: {
  role?: string | null
  roles?: string[] | null
}): OrgRole | null => {
  const roles = new Set([auth.role, ...(auth.roles ?? [])].filter(Boolean))

  if (roles.has("owner") || roles.has("user_owner")) return "owner"
  if (roles.has("admin") || roles.has("user_admin")) return "admin"
  if (roles.has("member") || roles.has("user_member")) return "member"

  return null
}

export const resolveDeviceAuth = async (
  request: Request
): Promise<ResolvedAuth | null> => {
  try {
    const auth = await withAuth()
    if (auth.user) {
      const platformRole = await getPlatformRoleForUser({
        id: auth.user.id,
        email: auth.user.email,
      })
      const orgRole =
        roleFromWorkOSAuth(auth) ??
        (auth.organizationId
          ? await resolveOrgRole(auth.user.id, auth.organizationId)
          : null)

      return {
        type: "workos",
        userId: auth.user.id,
        email: auth.user.email ?? null,
        organizationId: auth.organizationId ?? null,
        orgRole,
        platformRole,
        source: "direct_cookie",
      }
    }
  } catch {
    // Fall through to the proxy/API-key resolver below.
  }

  return resolveAuthContext(request)
}

const toUnauthorized = (set: RouteSet) => {
  set.status = 401
  return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
}

const toQueueUnavailable = (set: RouteSet) => {
  set.status = 503
  return {
    ok: false,
    error: "QUEUE_UNAVAILABLE",
    message:
      "Template sync queue is unavailable. Check REDIS_URL and Redis credentials.",
  }
}

const toTokenEncryptionUnavailable = (set: RouteSet) => {
  set.status = 500
  return {
    ok: false,
    error: "TOKEN_ENCRYPTION_FAILED",
    message:
      "Unable to encrypt device token. Check APP_KEY configuration and try again.",
  }
}

const toTokenInvalid = (set: RouteSet) => {
  set.status = 400
  return {
    ok: false,
    error: "BAD_REQUEST",
    message:
      "Stored device token cannot be decrypted. Paste a fresh Meta Access Token and save the device, then sync again.",
  }
}

const toMethodNotAllowed = (set: RouteSet, message: string) => {
  set.status = 405
  return { ok: false, error: "METHOD_NOT_ALLOWED", message }
}

const buildDeviceUpdateData = async (
  input: ReturnType<typeof updateDeviceSchema.parse>
): Promise<Prisma.WhatsappDeviceUpdateInput> => {
  const data: Prisma.WhatsappDeviceUpdateInput = {}

  if (input.phoneNumber !== undefined) data.phoneNumber = input.phoneNumber
  if (input.status !== undefined) data.status = input.status
  if (input.token !== undefined) {
    data.token = null
    data.tokenEncrypted = await encryptWhatsAppToken(input.token)
    data.tokenIv = null
  }
  if (input.quotaBase !== undefined) data.quotaBase = input.quotaBase
  if (input.dailyLimitMessage !== undefined) {
    data.dailyLimitMessage = input.dailyLimitMessage
  }
  if (input.callbackUrl !== undefined) {
    data.callbackUrl = input.callbackUrl || null
  }

  return data
}

export const devicesRoutes = new Elysia({ prefix: "/devices" })
  .get("/", async ({ request, query, set }: any) => {
    const whatsappAuth = await resolveDeviceAuth(request)
    if (!whatsappAuth) return toUnauthorized(set)

    const where: Record<string, unknown> = {}
    if (!isSuperAdmin(whatsappAuth)) {
      where.organizationId = whatsappAuth.organizationId!
    } else if (query?.organizationId) {
      where.organizationId = String(query.organizationId)
    }

    const devices = await prisma.whatsappDevice.findMany({
      where,
      orderBy: { createdAt: "desc" },
    })

    return { ok: true, devices: devices.map(toDeviceListItem) }
  })
  .get("/:id", async ({ request, params: { id }, set }: any) => {
    const whatsappAuth = await resolveDeviceAuth(request)
    if (!whatsappAuth) return toUnauthorized(set)

    const device = await prisma.whatsappDevice.findUnique({
      where: { id },
    })

    if (!device) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Device not found." }
    }

    if (
      !isSuperAdmin(whatsappAuth) &&
      device.organizationId !== whatsappAuth.organizationId
    ) {
      set.status = 403
      return { ok: false, error: "FORBIDDEN", message: "Access denied." }
    }

    return { ok: true, device: toDeviceDetail(device) }
  })
  .post("/", ({ set }: any) =>
    toMethodNotAllowed(
      set,
      "WhatsApp devices can only be created by admins from the portal."
    )
  )
  .patch("/:id", async ({ request, params: { id }, body, set }: any) => {
    const whatsappAuth = await resolveDeviceAuth(request)
    if (!whatsappAuth) return toUnauthorized(set)

    const parsed = updateDeviceSchema.safeParse(body)
    if (!parsed.success) {
      set.status = 422
      return {
        ok: false,
        error: "VALIDATION_ERROR",
        message: "Please fix the highlighted fields and try again.",
        fieldErrors: fieldErrorMapFromIssues(parsed.error.issues),
      }
    }

    const device = await prisma.whatsappDevice.findUnique({
      where: { id },
    })

    if (!device) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Device not found." }
    }

    if (
      !isSuperAdmin(whatsappAuth) &&
      device.organizationId !== whatsappAuth.organizationId
    ) {
      set.status = 403
      return { ok: false, error: "FORBIDDEN", message: "Access denied." }
    }

    const updated = await prisma.whatsappDevice.update({
      where: { id },
      data: await buildDeviceUpdateData(parsed.data),
    })

    return { ok: true, device: toDeviceDetail(updated) }
  })
  .delete("/:id", ({ set }: any) =>
    toMethodNotAllowed(
      set,
      "WhatsApp devices cannot be deleted from the console API."
    )
  )
  .post("/:id/verify", async ({ request, params: { id }, set }: any) => {
    const whatsappAuth = await resolveDeviceAuth(request)
    if (!whatsappAuth) return toUnauthorized(set)

    const device = await prisma.whatsappDevice.findUnique({
      where: { id },
    })

    if (!device) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Device not found." }
    }

    if (
      !isSuperAdmin(whatsappAuth) &&
      device.organizationId !== whatsappAuth.organizationId
    ) {
      set.status = 403
      return { ok: false, error: "FORBIDDEN", message: "Access denied." }
    }

    // Ensure phone ID exists
    if (!device.whatsappPhoneId) {
      set.status = 422
      return { ok: false, error: "VALIDATION_ERROR", message: "Device missing phone ID." }
    }

    // Call Meta API to verify device health
    const healthResult = await checkDeviceHealth({
      organizationId: device.organizationId,
      phoneId: device.whatsappPhoneId,
    })

    // Log the health check result
    await logWhatsappAuditEvent({
      action: "DEVICE_STATUS_CHANGED",
      status: healthResult.ok ? "OK" : "FAILED",
      organizationId: device.organizationId,
      deviceId: device.id,
      adminId: whatsappAuth.type === "workos" ? whatsappAuth.userId : null,
      message: healthResult.ok
        ? "Health check passed — device is connected"
        : `Health check failed: ${healthResult.error}`,
    })

    // Update status based on health result
    const updated = await prisma.whatsappDevice.update({
      where: { id },
      data: {
        status: healthResult.ok ? "ACTIVE" : "DISCONNECTED",
        lastHeartbeatAt: healthResult.ok ? new Date() : undefined,
        lastDisconnectedAt: !healthResult.ok ? new Date() : undefined,
      },
    })

    return {
      ok: true,
      device: toDeviceDetail(updated),
      health: healthResult,
    }
  })
  .post("/:id/reconnect", async ({ request, params: { id }, set }: any) => {
    const whatsappAuth = await resolveDeviceAuth(request)
    if (!whatsappAuth) return toUnauthorized(set)

    const device = await prisma.whatsappDevice.findUnique({
      where: { id },
    })

    if (!device) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Device not found." }
    }

    if (
      !isSuperAdmin(whatsappAuth) &&
      device.organizationId !== whatsappAuth.organizationId
    ) {
      set.status = 403
      return { ok: false, error: "FORBIDDEN", message: "Access denied." }
    }

    const updated = await prisma.whatsappDevice.update({
      where: { id },
      data: { status: "ACTIVE" },
    })

    return { ok: true, device: toDeviceDetail(updated) }
  })
  .post(
    "/:id/sync-templates",
    async ({ request, params: { id }, set }: any) => {
      const whatsappAuth = await resolveDeviceAuth(request)
      if (!whatsappAuth) return toUnauthorized(set)

      const device = await prisma.whatsappDevice.findUnique({
        where: { id },
        select: {
          id: true,
          token: true,
          tokenEncrypted: true,
          tokenIv: true,
          organizationId: true,
          whatsappBusinessAccountId: true,
          whatsappPhoneId: true,
        },
      })

      if (!device) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Device not found." }
      }

      if (
        !isSuperAdmin(whatsappAuth) &&
        device.organizationId !== whatsappAuth.organizationId
      ) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Access denied." }
      }

      const encryptAndPersistRawToken = async (rawToken: string) => {
        const encrypted = await encryptWhatsAppToken(rawToken)
        await prisma.whatsappDevice.update({
          where: { id: device.id },
          data: {
            token: null,
            tokenEncrypted: encrypted,
            tokenIv: null,
          },
        })
        return encrypted
      }

      let tokenEncrypted = device.tokenEncrypted
      if (tokenEncrypted) {
        const encryptedParts = tokenEncrypted.split(".")
        const decryptableToken =
          device.tokenIv && encryptedParts.length === 2
            ? `${encryptedParts[0]}.${device.tokenIv}.${encryptedParts[1]}`
            : tokenEncrypted

        try {
          await decryptWhatsAppToken(decryptableToken)
        } catch (error) {
          if (!device.token) {
            console.error("[WhatsAppDevices] Token decryption failed:", error)
            return toTokenInvalid(set)
          }

          try {
            tokenEncrypted = await encryptAndPersistRawToken(device.token)
          } catch (encryptError) {
            console.error(
              "[WhatsAppDevices] Token encryption failed:",
              encryptError
            )
            return toTokenEncryptionUnavailable(set)
          }
        }
      } else if (device.token) {
        try {
          tokenEncrypted = await encryptAndPersistRawToken(device.token)
        } catch (error) {
          console.error("[WhatsAppDevices] Token encryption failed:", error)
          return toTokenEncryptionUnavailable(set)
        }
      }

      if (!tokenEncrypted) {
        set.status = 400
        return {
          ok: false,
          error: "BAD_REQUEST",
          message: "Encrypted device token required for template sync.",
        }
      }

      if (!device.whatsappBusinessAccountId || !device.whatsappPhoneId) {
        set.status = 400
        return {
          ok: false,
          error: "BAD_REQUEST",
          message:
            "WhatsApp Business Account ID and Phone Number ID are required for template sync.",
        }
      }

      try {
        await enqueueWhatsAppTemplateSync(
          device.organizationId,
          device.id,
          "sync-templates"
        )
      } catch (error) {
        console.error("[WhatsAppDevices] Template sync enqueue failed:", error)
        return toQueueUnavailable(set)
      }

      return { ok: true, message: "Sync job enqueued." }
    }
  )
  // POST /:id/regenerate-signing-secret — regenerate webhook HMAC signing secret
  .post(
    "/:id/regenerate-signing-secret",
    async ({ request, params: { id }, set }: any) => {
      const whatsappAuth = await resolveDeviceAuth(request)
      if (!whatsappAuth) return toUnauthorized(set)

      const device = await prisma.whatsappDevice.findUnique({
        where: { id },
        select: { id: true, organizationId: true },
      })

      if (!device) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Device not found." }
      }

      if (
        !isSuperAdmin(whatsappAuth) &&
        device.organizationId !== whatsappAuth.organizationId
      ) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Access denied." }
      }

      const newSecret = generateWebhookSigningSecret()
      await prisma.whatsappDevice.update({
        where: { id },
        data: { appSecret: newSecret },
      })

      return {
        ok: true,
        signingSecret: newSecret,
        message: "Signing secret regenerated. Update your webhook configuration.",
      }
    }
  )
