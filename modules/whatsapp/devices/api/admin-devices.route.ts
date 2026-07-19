/**
 * WhatsApp Devices — Admin API Routes
 *
 * Mounted at /api/admin/devices
 */

import { Elysia } from "elysia"
import { Prisma } from "@prisma/client"
import Decimal = Prisma.Decimal

import { prisma } from "@/lib/prisma"
import { fieldErrorMapFromIssues } from "@/lib/validation"
import {
  addonQuotaTopUpSchema,
  adminCreateDeviceSchema,
  topUpInputSchema,
  updateDeviceSchema,
  DeviceNotFoundError,
} from "../devices.schemas"
import { createDeviceService } from "../devices.service"
import { enqueueWhatsAppTemplateSync } from "@/lib/queue/whatsapp-template-sync"
import {
  decryptWhatsAppToken,
  encryptWhatsAppToken,
} from "@/lib/whatsapp/crypto"
import {
  requireSuperAdmin,
  type AdminActorContext,
  type AdminApiError,
} from "@/modules/admin/api/admin.guards"
import {
  logWhatsappAuditEvent,
  type WhatsappAuditAction,
  type WhatsappAuditEventStatus,
} from "@/modules/whatsapp/audit/whatsapp-audit.service"

const MAX_BALANCE = new Decimal("999999999.99")

type RouteSet = {
  status?: number | string
}

type AdminGuard = (set: RouteSet) => Promise<AdminActorContext | AdminApiError>

const toServerError = (set: RouteSet, message: string) => {
  set.status = 500
  return {
    ok: false as const,
    error: "INTERNAL_SERVER_ERROR" as const,
    message,
  }
}

const toTokenInvalid = (set: RouteSet) => {
  set.status = 400
  return {
    ok: false as const,
    error: "BAD_REQUEST" as const,
    message: "Device token is corrupt and cannot be decrypted.",
  }
}

const toTokenEncryptionUnavailable = (set: RouteSet) => {
  set.status = 500
  return {
    ok: false as const,
    error: "INTERNAL_SERVER_ERROR" as const,
    message: "Token encryption service unavailable.",
  }
}

const isAdminError = (
  value: AdminActorContext | AdminApiError
): value is AdminApiError => "ok" in value && !value.ok

export const createAdminDevicesRoutes = (
  deps: { requireSuperAdmin?: AdminGuard } = {}
) => {
  const guard: AdminGuard = deps.requireSuperAdmin ?? requireSuperAdmin

  return new Elysia({ prefix: "/admin/devices" })
    .get("/", async ({ query, set }: any) => {
      const actor = await guard(set)
      if (isAdminError(actor)) return actor

      const take = Math.min(Number(query.take) || 50, 100)
      const skip = Number(query.skip) || 0

      const [devices, total] = await Promise.all([
        prisma.whatsappDevice.findMany({
          orderBy: { createdAt: "desc" },
          take,
          skip,
        }),
        prisma.whatsappDevice.count(),
      ])

      return {
        ok: true as const,
        devices: devices.map((d) => ({
          id: d.id,
          organizationId: d.organizationId,
          phoneNumber: d.phoneNumber,
          status: d.status,
          balance: Number(d.balance.toString()),
          quotaBase: Number(d.quotaBase.toString()),
          dailyLimitMessage: d.dailyLimitMessage,
          whatsappBusinessAccountId: d.whatsappBusinessAccountId,
          whatsappPhoneId: d.whatsappPhoneId,
          whatsappApplicationId: d.whatsappApplicationId,
          callbackUrl: d.callbackUrl,
          whatsappProfile: d.whatsappProfile,
          createdAt: d.createdAt.toISOString(),
          updatedAt: d.updatedAt.toISOString(),
        })),
        total,
        take,
        skip,
      }
    })
    .get("/:id", async ({ params: { id }, set }: any) => {
      const actor = await guard(set)
      if (isAdminError(actor)) return actor

      const device = await prisma.whatsappDevice.findUnique({
        where: { id },
      })

      if (!device) {
        set.status = 404
        return {
          ok: false as const,
          error: "NOT_FOUND" as const,
          message: "Device not found.",
        }
      }

      return {
        ok: true as const,
        device: {
          id: device.id,
          organizationId: device.organizationId,
          phoneNumber: device.phoneNumber,
          status: device.status,
          balance: Number(device.balance.toString()),
          dailyLimitMessage: device.dailyLimitMessage,
          whatsappBusinessAccountId: device.whatsappBusinessAccountId,
          whatsappPhoneId: device.whatsappPhoneId,
          whatsappApplicationId: device.whatsappApplicationId,
          callbackUrl: device.callbackUrl,
          expiredAt: device.expiredAt?.toISOString() ?? null,
          whatsappProfile: device.whatsappProfile,
          createdAt: device.createdAt.toISOString(),
          updatedAt: device.updatedAt.toISOString(),
        },
      }
    })
    .post("/", async ({ body, set }: any) => {
      const actor = await guard(set)
      if (isAdminError(actor)) return actor

      const parsed = adminCreateDeviceSchema.safeParse(body)
      if (!parsed.success) {
        set.status = 422
        return {
          ok: false as const,
          error: "VALIDATION_ERROR" as const,
          message: "Please fix the highlighted fields and try again.",
          fieldErrors: fieldErrorMapFromIssues(parsed.error.issues),
        }
      }

      try {
        const device = await createDeviceService().create({
          ...parsed.data,
          organizationId: parsed.data.organizationId,
        })

        set.status = 201
        return { ok: true as const, device }
      } catch (error) {
        console.error("[AdminDevices] Create error:", error)
        return toServerError(set, "Unable to create device.")
      }
    })
    .patch("/:id", async ({ params: { id }, body, set }: any) => {
      const actor = await guard(set)
      if (isAdminError(actor)) return actor

      const parsed = updateDeviceSchema.safeParse(body)
      if (!parsed.success) {
        set.status = 422
        return {
          ok: false as const,
          error: "VALIDATION_ERROR" as const,
          message: "Please fix the highlighted fields and try again.",
          fieldErrors: fieldErrorMapFromIssues(parsed.error.issues),
        }
      }

      try {
        const service = createDeviceService()
        // Fetch current device for change detection
        const currentDevice = await prisma.whatsappDevice.findUnique({
          where: { id },
          select: {
            id: true,
            organizationId: true,
            status: true,
            callbackUrl: true,
          },
        })

        const device = await service.update(id, parsed.data, null)

        // Audit: detect field changes
        if (currentDevice) {
          const changedFields: string[] = []
          let action: WhatsappAuditAction = "DEVICE_INFO_UPDATED"

          if (
            parsed.data.callbackUrl !== undefined &&
            parsed.data.callbackUrl !== currentDevice.callbackUrl
          ) {
            action = "DEVICE_CALLBACK_URL_UPDATED"
            changedFields.push("callbackUrl")
          }
          if (
            parsed.data.status &&
            parsed.data.status !== currentDevice.status
          ) {
            action = "DEVICE_STATUS_CHANGED"
            changedFields.push("status")
          }

          if (changedFields.length > 0) {
            logWhatsappAuditEvent({
              action,
              organizationId: currentDevice.organizationId,
              deviceId: id,
              adminId: actor.userId,
              message: `Device updated: ${changedFields.join(", ")}`,
              status: "OK",
              details: { changedFields },
            })
          }
        }

        return { ok: true as const, device }
      } catch (error) {
        // Log failed update
        if (!(error instanceof Error && error.name === "DeviceNotFoundError")) {
          try {
            const orgId = (
              await prisma.whatsappDevice.findUnique({
                where: { id },
                select: { organizationId: true },
              })
            )?.organizationId
            logWhatsappAuditEvent({
              action: "DEVICE_INFO_UPDATED",
              organizationId: orgId ?? "",
              deviceId: id,
              adminId: actor.userId,
              message: "Device update failed",
              errorMessage: String(error),
              status: "FAILED",
            })
          } catch {
            /* ignore */
          }
        }

        if (error instanceof Error && error.name === "DeviceNotFoundError") {
          set.status = 404
          return {
            ok: false as const,
            error: "NOT_FOUND" as const,
            message: "Device not found.",
          }
        }

        console.error("[AdminDevices] Update error:", error)
        return toServerError(set, "Unable to update device.")
      }
    })
    .delete("/:id", async ({ params: { id }, set }: any) => {
      const actor = await guard(set)
      if (isAdminError(actor)) return actor

      try {
        const service = createDeviceService()
        await service.delete(id)
        return { ok: true as const, message: "Device deleted." }
      } catch (error) {
        if (error instanceof Error && error.name === "DeviceNotFoundError") {
          set.status = 404
          return {
            ok: false as const,
            error: "NOT_FOUND" as const,
            message: "Device not found.",
          }
        }

        console.error("[AdminDevices] Delete error:", error)
        return toServerError(set, "Unable to delete device.")
      }
    })
    .post("/:id/sync-templates", async ({ params: { id }, set }: any) => {
      const actor = await guard(set)
      if (isAdminError(actor)) return actor

      const device = await prisma.whatsappDevice.findUnique({
        where: { id },
        select: {
          id: true,
          token: true,
          tokenEncrypted: true,
          tokenIv: true,
          organizationId: true,
        },
      })

      if (!device) {
        logWhatsappAuditEvent({
          action: "TEMPLATE_SYNC_FAILED",
          organizationId: "",
          deviceId: id,
          adminId: actor.userId,
          message: "Device not found for sync",
          status: "FAILED",
        })
        set.status = 404
        return {
          ok: false as const,
          error: "NOT_FOUND" as const,
          message: "Device not found.",
        }
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
            console.error("[AdminDevices] Token decryption failed:", error)
            return toTokenInvalid(set)
          }

          try {
            tokenEncrypted = await encryptAndPersistRawToken(device.token)
          } catch (encryptError) {
            console.error(
              "[AdminDevices] Token encryption failed:",
              encryptError
            )
            return toTokenEncryptionUnavailable(set)
          }
        }
      } else if (device.token) {
        try {
          tokenEncrypted = await encryptAndPersistRawToken(device.token)
        } catch (error) {
          console.error("[AdminDevices] Token encryption failed:", error)
          return toTokenEncryptionUnavailable(set)
        }
      }

      if (!tokenEncrypted) {
        logWhatsappAuditEvent({
          action: "TEMPLATE_SYNC_FAILED",
          organizationId: device.organizationId,
          deviceId: id,
          adminId: actor.userId,
          message: "No device token configured",
          status: "FAILED",
        })
        set.status = 400
        return {
          ok: false as const,
          error: "BAD_REQUEST" as const,
          message: "Encrypted device token required for template sync.",
        }
      }

      logWhatsappAuditEvent({
        action: "TEMPLATE_SYNC_REQUESTED",
        organizationId: device.organizationId,
        deviceId: id,
        adminId: actor.userId,
        message: "Template sync requested",
        status: "STARTED",
      })
      await enqueueWhatsAppTemplateSync(
        device.organizationId,
        device.id,
        "sync-templates"
      )
      logWhatsappAuditEvent({
        action: "TEMPLATE_SYNCED",
        organizationId: device.organizationId,
        deviceId: id,
        adminId: actor.userId,
        message: "Sync job enqueued",
        status: "OK",
      })

      return { ok: true as const, message: "Sync job enqueued." }
    })
    .post("/:id/top-up", async ({ params: { id }, body, set }: any) => {
      const actor = await guard(set)
      if (isAdminError(actor)) return actor

      const parsed = topUpInputSchema.safeParse(body)
      if (!parsed.success) {
        set.status = 422
        return {
          ok: false as const,
          error: "VALIDATION_ERROR" as const,
          message: "Please fix the highlighted fields and try again.",
          fieldErrors: fieldErrorMapFromIssues(parsed.error.issues),
        }
      }

      const { amount, reason } = parsed.data

      try {
        const result = await prisma.$transaction(async (tx) => {
          const device = await tx.whatsappDevice.findUnique({
            where: { id },
          })

          if (!device) {
            throw new Error("DEVICE_NOT_FOUND")
          }

          const balanceAfter = device.balance.plus(amount)

          if (balanceAfter.gt(MAX_BALANCE)) {
            throw new Error("BALANCE_LIMIT_EXCEEDED")
          }

          let billingAccount = await tx.billingAccount.findUnique({
            where: { organizationId: device.organizationId },
          })

          if (!billingAccount) {
            billingAccount = await tx.billingAccount.create({
              data: {
                organizationId: device.organizationId,
                balance: new Decimal(0),
                currency: "IDR",
              },
            })
          }

          const [updatedDevice] = await Promise.all([
            tx.whatsappDevice.update({
              where: { id },
              data: { balance: balanceAfter },
            }),
            tx.billingAdjustment.create({
              data: {
                billingAccountId: billingAccount.id,
                adjustmentType: "CREDIT",
                amount: new Decimal(amount),
                currency: "IDR",
                reason: `Device top-up: ${reason} (device: ${id})`,
                metadataJson: {
                  deviceId: id,
                  performedBy: actor.userId,
                },
              },
            }),
          ])

          return { updatedDevice }
        })

        return {
          ok: true as const,
          newBalance: Number(result.updatedDevice.balance.toString()),
          amount,
        }
      } catch (error) {
        if (error instanceof Error && error.message === "DEVICE_NOT_FOUND") {
          set.status = 404
          return {
            ok: false as const,
            error: "NOT_FOUND" as const,
            message: "Device not found.",
          }
        }

        if (
          error instanceof Error &&
          error.message === "BALANCE_LIMIT_EXCEEDED"
        ) {
          set.status = 400
          return {
            ok: false as const,
            error: "BALANCE_LIMIT_EXCEEDED" as const,
            message: "Top-up would exceed maximum balance.",
          }
        }

        console.error("[AdminDevices] Top-up error:", error)
        return toServerError(set, "Unable to process top-up.")
      }
    })
    .post("/:id/addon-quota", async ({ params: { id }, body, set }: any) => {
      const actor = await guard(set)
      if (isAdminError(actor)) return actor

      const parsed = addonQuotaTopUpSchema.safeParse(body)
      if (!parsed.success) {
        set.status = 422
        return {
          ok: false as const,
          error: "VALIDATION_ERROR" as const,
          message: "Invalid input.",
          fields: fieldErrorMapFromIssues(parsed.error.issues),
        }
      }

      const { organizationId, amount, reason } = parsed.data

      try {
        const service = createDeviceService()
        const device = await service.topUpAddonQuota(id, amount, {
          organizationId,
          reason,
        })
        logWhatsappAuditEvent({
          action: "DEVICE_QUOTA_TOPUP",
          organizationId: device.organizationId,
          deviceId: id,
          adminId: actor.userId,
          message: `Addon quota topped up by ${amount}`,
          status: "OK",
          details: { amount, ...(reason ? { reason } : {}) },
        })
        return { ok: true as const, device }
      } catch (error) {
        if (error instanceof DeviceNotFoundError) {
          set.status = 404
          return {
            ok: false as const,
            error: "NOT_FOUND" as const,
            message: "Device not found.",
          }
        }
        if (
          error instanceof Error &&
          error.message === "AMOUNT_MUST_BE_POSITIVE"
        ) {
          set.status = 400
          return {
            ok: false as const,
            error: "VALIDATION_ERROR" as const,
            message: error.message,
          }
        }
        console.error("[AdminDevices] Addon quota top-up error:", error)
        return toServerError(set, "Unable to top up addon quota.")
      }
    })
}
