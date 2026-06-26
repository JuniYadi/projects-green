import { Elysia } from "elysia"
import { z } from "zod"

import { fieldErrorMapFromIssues } from "@/lib/validation"
import { prisma } from "@/lib/prisma"
import { updateBusinessProfileSchema } from "@/lib/whatsapp/meta-cloud/types/business-profile"
import { getProfile, updateProfile } from "../business-profile.service"
import { resolveDeviceAuth, isSuperAdmin } from "./devices.route"

type RouteSet = { status?: number | string }

const toUnauthorized = (set: RouteSet) => {
  set.status = 401
  return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
}

const toNotFound = (set: RouteSet, message: string) => {
  set.status = 404
  return { ok: false, error: "NOT_FOUND", message }
}

const toForbidden = (set: RouteSet) => {
  set.status = 403
  return { ok: false, error: "FORBIDDEN", message: "Access denied." }
}

const toBadRequest = (set: RouteSet, message: string) => {
  set.status = 400
  return { ok: false, error: "BAD_REQUEST", message }
}

export const businessProfileRoutes = new Elysia({ prefix: "/devices/:id/profile" })
  .get("/", async ({ request, params: { id }, set }: any) => {
    const auth = await resolveDeviceAuth(request)
    if (!auth) return toUnauthorized(set)
    if (!auth.organizationId) return toBadRequest(set, "Organization context required.")

    const device = await prisma.whatsappDevice.findUnique({ where: { id } })
    if (!device) return toNotFound(set, "Device not found.")
    if (!isSuperAdmin(auth) && device.organizationId !== auth.organizationId) {
      return toForbidden(set)
    }

    const profile = await getProfile(id, auth.organizationId)
    return { ok: true, profile }
  })
  .patch("/", async ({ request, params: { id }, body, set }: any) => {
    const auth = await resolveDeviceAuth(request)
    if (!auth) return toUnauthorized(set)
    if (!auth.organizationId) return toBadRequest(set, "Organization context required.")

    const device = await prisma.whatsappDevice.findUnique({ where: { id } })
    if (!device) return toNotFound(set, "Device not found.")
    if (!isSuperAdmin(auth) && device.organizationId !== auth.organizationId) {
      return toForbidden(set)
    }

    const parsed = updateBusinessProfileSchema.safeParse(body)
    if (!parsed.success) {
      set.status = 422
      return {
        ok: false,
        error: "VALIDATION_ERROR",
        message: "Please fix the highlighted fields and try again.",
        fieldErrors: fieldErrorMapFromIssues(parsed.error.issues),
      }
    }

    const profile = await updateProfile(id, parsed.data, auth.organizationId)
    return { ok: true, profile }
  })
