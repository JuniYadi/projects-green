import { Elysia } from "elysia"

import { fieldErrorMapFromIssues } from "@/lib/validation"
import { updateBusinessProfileSchema } from "@/lib/whatsapp/meta-cloud/types/business-profile"
import {
  getProfile,
  syncDeviceFromMeta,
  updateProfile,
  uploadProfilePicture,
  DeviceNoPhoneIdError,
  DeviceNoMetaAppIdError,
  ProfileNotFoundError,
} from "../business-profile.service"
import { toBusinessProfileDTO } from "../business-profile.dto"
import { DeviceNotFoundError, DeviceNotOwnedError } from "../devices.schemas"
import { resolveDeviceAuth } from "./devices.route"

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

const toConflict = (set: RouteSet, message: string) => {
  set.status = 409
  return { ok: false, error: "CONFLICT", message }
}

export const businessProfileRoutes = new Elysia({
  prefix: "/devices/:id/profile",
})
  .get("/", async ({ request, params: { id }, set }: any) => {
    const auth = await resolveDeviceAuth(request)
    if (!auth) return toUnauthorized(set)
    if (!auth.organizationId)
      return toBadRequest(set, "Organization context required.")

    try {
      const profile = await getProfile(id, auth.organizationId)
      return { ok: true, profile: toBusinessProfileDTO(profile) }
    } catch (e) {
      if (e instanceof DeviceNotFoundError) return toNotFound(set, e.message)
      if (e instanceof DeviceNotOwnedError) return toForbidden(set)
      if (e instanceof DeviceNoPhoneIdError) return toConflict(set, e.message)
      if (e instanceof ProfileNotFoundError) return toNotFound(set, e.message)
      throw e
    }
  })
  .post("/sync", async ({ request, params: { id }, set }: any) => {
    const auth = await resolveDeviceAuth(request)
    if (!auth) return toUnauthorized(set)
    if (!auth.organizationId)
      return toBadRequest(set, "Organization context required.")

    try {
      const profile = await syncDeviceFromMeta(id, auth.organizationId)
      return { ok: true, profile: toBusinessProfileDTO(profile) }
    } catch (e: any) {
      if (e instanceof DeviceNotFoundError) return toNotFound(set, e.message)
      if (e instanceof DeviceNotOwnedError) return toForbidden(set)
      if (e instanceof DeviceNoPhoneIdError) return toConflict(set, e.message)
      set.status = 500
      return {
        ok: false,
        error: "SYNC_FAILED",
        message: e?.message || "Sync failed",
      }
    }
  })
  .patch("/", async ({ request, params: { id }, body, set }: any) => {
    const auth = await resolveDeviceAuth(request)
    if (!auth.organizationId)
      return toBadRequest(set, "Organization context required.")

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

    try {
      const profile = await updateProfile(id, parsed.data, auth.organizationId)
      return { ok: true, profile: toBusinessProfileDTO(profile) }
    } catch (e) {
      if (e instanceof DeviceNotFoundError) return toNotFound(set, e.message)
      if (e instanceof DeviceNotOwnedError) return toForbidden(set)
      if (e instanceof DeviceNoPhoneIdError) return toConflict(set, e.message)
      if (e instanceof ProfileNotFoundError) return toNotFound(set, e.message)
      throw e
    }
  })
  .post("/picture", async ({ request, params: { id }, set }: any) => {
    const auth = await resolveDeviceAuth(request)
    if (!auth) return toUnauthorized(set)
    if (!auth.organizationId) {
      return toBadRequest(set, "Organization context required.")
    }

    const contentType = request.headers.get("content-type") ?? ""
    if (!contentType.includes("multipart/form-data")) {
      return toBadRequest(set, "Expected multipart/form-data.")
    }

    const formData = await request.formData()
    const file = formData.get("file")
    if (!(file instanceof File)) {
      set.status = 422
      return {
        ok: false,
        error: "VALIDATION_ERROR",
        message: "An image file is required.",
      }
    }

    if (file.type !== "image/jpeg" && file.type !== "image/png") {
      set.status = 400
      return {
        ok: false,
        error: "UNSUPPORTED_MEDIA_TYPE",
        message: "Profile pictures must be JPEG or PNG images.",
      }
    }

    if (file.size > 5 * 1024 * 1024) {
      set.status = 400
      return {
        ok: false,
        error: "FILE_TOO_LARGE",
        message: "Profile pictures must be 5 MB or smaller.",
      }
    }

    try {
      const profile = await uploadProfilePicture(
        id,
        {
          data: await file.arrayBuffer(),
          fileName: file.name || "profile-picture",
          mimeType: file.type,
        },
        auth.organizationId
      )
      return { ok: true, profile: toBusinessProfileDTO(profile) }
    } catch (e) {
      if (e instanceof DeviceNotFoundError) return toNotFound(set, e.message)
      if (e instanceof DeviceNotOwnedError) return toForbidden(set)
      if (e instanceof DeviceNoPhoneIdError) return toConflict(set, e.message)
      if (e instanceof DeviceNoMetaAppIdError) {
        return toConflict(set, e.message)
      }
      if (e instanceof ProfileNotFoundError) return toNotFound(set, e.message)
      throw e
    }
  })
