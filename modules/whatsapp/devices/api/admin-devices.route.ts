/**
 * WhatsApp Devices — Admin API Routes
 *
 * Mounted at /api/whatsapp/admin/devices
 */

import { Elysia } from "elysia"
import { Prisma } from "@prisma/client"
import Decimal = Prisma.Decimal

import { prisma } from "@/lib/prisma"
import { resolveAuthContext } from "@/lib/auth/resolve-proxy-auth"
import { fieldErrorMapFromIssues } from "@/lib/validation"
import { topUpInputSchema } from "../devices.schemas"

const MAX_BALANCE = new Decimal("999999999.99")

type RouteSet = {
  status?: number | string
}

const toServerError = (set: RouteSet, message: string) => {
  set.status = 500
  return {
    ok: false as const,
    error: "INTERNAL_SERVER_ERROR" as const,
    message,
  }
}

export const createAdminDevicesRoutes = () => {
  return new Elysia({ prefix: "/admin/devices" })
    .get("/", async ({ request, query, set }: any) => {
      const auth = await resolveAuthContext(request)
      if (!auth) {
        set.status = 401
        return { ok: false as const, error: "UNAUTHORIZED" as const, message: "Auth required." }
      }

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
          createdAt: d.createdAt.toISOString(),
          updatedAt: d.updatedAt.toISOString(),
        })),
        total,
        take,
        skip,
      }
    })
    .get("/:id", async ({ request, params: { id }, set }: any) => {
      const auth = await resolveAuthContext(request)
      if (!auth) {
        set.status = 401
        return { ok: false as const, error: "UNAUTHORIZED" as const, message: "Auth required." }
      }

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
          quotaBase: Number(device.quotaBase.toString()),
          quotaBaseIn: device.quotaBaseIn,
          quotaBaseOut: device.quotaBaseOut,
          dailyLimitMessage: device.dailyLimitMessage,
          whatsappBusinessAccountId: device.whatsappBusinessAccountId,
          whatsappPhoneId: device.whatsappPhoneId,
          callbackUrl: device.callbackUrl,
          expiredAt: device.expiredAt?.toISOString() ?? null,
          createdAt: device.createdAt.toISOString(),
          updatedAt: device.updatedAt.toISOString(),
        },
      }
    })
    .post("/:id/top-up", async ({ request, params: { id }, body, set }: any) => {
      const auth = await resolveAuthContext(request)
      if (!auth) {
        set.status = 401
        return { ok: false as const, error: "UNAUTHORIZED" as const, message: "Auth required." }
      }

      const currentUser = auth.type === "workos" ? { id: auth.userId } : null
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

          // Find or create a billing account for the device's org
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
                  performedBy: currentUser?.id,
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

        if (error instanceof Error && error.message === "BALANCE_LIMIT_EXCEEDED") {
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
}

export const adminDevicesRoutes = createAdminDevicesRoutes()
