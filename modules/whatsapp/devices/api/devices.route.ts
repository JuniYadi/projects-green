import { Elysia } from "elysia"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import {
  resolveAuthContext,
  type ResolvedAuth,
} from "@/lib/auth/resolve-proxy-auth"
import { fieldErrorMapFromIssues } from "@/lib/validation"
import { toDeviceDetail, toDeviceListItem } from "../devices.dto"
import { updateDeviceSchema } from "../devices.schemas"

type RouteSet = {
  status?: number | string
}

const isSuperAdmin = (auth: ResolvedAuth) =>
  auth.type === "workos" && auth.platformRole === "super_admin"

const toUnauthorized = (set: RouteSet) => {
  set.status = 401
  return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
}

const toMethodNotAllowed = (set: RouteSet, message: string) => {
  set.status = 405
  return { ok: false, error: "METHOD_NOT_ALLOWED", message }
}

const buildDeviceUpdateData = (
  input: ReturnType<typeof updateDeviceSchema.parse>
): Prisma.WhatsappDeviceUpdateInput => {
  const data: Prisma.WhatsappDeviceUpdateInput = {}

  if (input.phoneNumber !== undefined) data.phoneNumber = input.phoneNumber
  if (input.status !== undefined) data.status = input.status
  if (input.token !== undefined) data.token = input.token
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
  .get("/", async ({ request, set }: any) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) return toUnauthorized(set)

    const devices = await prisma.whatsappDevice.findMany({
      where: isSuperAdmin(whatsappAuth)
        ? {}
        : { organizationId: whatsappAuth.organizationId! },
      orderBy: { createdAt: "desc" },
    })

    return { ok: true, devices: devices.map(toDeviceListItem) }
  })
  .get("/:id", async ({ request, params: { id }, set }: any) => {
    const whatsappAuth = await resolveAuthContext(request)
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
    const whatsappAuth = await resolveAuthContext(request)
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
      data: buildDeviceUpdateData(parsed.data),
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
    const whatsappAuth = await resolveAuthContext(request)
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
  .post("/:id/reconnect", async ({ request, params: { id }, set }: any) => {
    const whatsappAuth = await resolveAuthContext(request)
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
