import { describe, expect, it, mock } from "bun:test"
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from "@workos-inc/node"
import { TenantWorkOSOperationUnsupportedError } from "@/modules/tenants/services/tenant-workos.errors"

// Mock the authkit + workos service deps so tenants.errors can load
mock.module("@workos-inc/authkit-nextjs", () => ({
  getWorkOS: () => ({
    userManagement: {},
    organizations: {},
  }),
  withAuth: async () => ({ user: null }),
}))

mock.module("@/lib/prisma", () => ({
  prisma: {},
}))

mock.module("@/lib/platform-role", () => ({
  getPlatformRoleForUser: async () => "none",
}))

const {
  isTenantApiError,
  toNotFoundError,
  toPolicyError,
  toUnauthorizedError,
  toWorkosApiError,
} = await import("@/modules/tenants/api/tenants.errors")

describe("tenants.errors", () => {
  describe("toPolicyError", () => {
    it("sets status 403 and returns policy error", () => {
      const set = { status: undefined as number | undefined }
      const result = toPolicyError(set, "TEST_CODE", "Test message")

      expect(set.status).toBe(403)
      expect(result).toEqual({
        ok: false,
        error: "FORBIDDEN",
        policyCode: "TEST_CODE",
        message: "Test message",
      })
    })
  })

  describe("toUnauthorizedError", () => {
    it("sets status 401 and returns unauthorized error", () => {
      const set = { status: undefined as number | undefined }
      const result = toUnauthorizedError(set)

      expect(set.status).toBe(401)
      expect(result).toEqual({
        ok: false,
        error: "UNAUTHORIZED",
        message: "You must be signed in to manage tenants.",
      })
    })
  })

  describe("toNotFoundError", () => {
    it("sets status 404 and returns not found error", () => {
      const set = { status: undefined as number | undefined }
      const result = toNotFoundError(set, "Resource not found.")

      expect(set.status).toBe(404)
      expect(result).toEqual({
        ok: false,
        error: "NOT_FOUND",
        message: "Resource not found.",
      })
    })
  })

  describe("toWorkosApiError", () => {
    it("handles BadRequestException", () => {
      const set = { status: undefined as number | undefined }
      const error = new BadRequestException({
        message: "bad request",
        code: "bad_request",
        requestID: "req_1",
      })
      const result = toWorkosApiError(set, error)

      expect(set.status).toBe(400)
      expect(result.error).toBe("WORKOS_BAD_REQUEST")
    })

    it("handles UnauthorizedException", () => {
      const set = { status: undefined as number | undefined }
      const error = new UnauthorizedException("req_1")
      const result = toWorkosApiError(set, error)

      expect(set.status).toBe(401)
      expect(result.error).toBe("WORKOS_UNAUTHORIZED")
    })

    it("handles generic 403 error object", () => {
      const set = { status: undefined as number | undefined }
      const error = { status: 403, message: "forbidden" }
      const result = toWorkosApiError(set, error)

      expect(set.status).toBe(403)
      expect(result.error).toBe("WORKOS_FORBIDDEN")
      expect(result.message).toBe("forbidden")
    })

    it("handles generic 403 without string message", () => {
      const set = { status: undefined as number | undefined }
      const error = { status: 403, message: 12345 }
      const result = toWorkosApiError(set, error)

      expect(set.status).toBe(403)
      expect(result.message).toBe(
        "You are not allowed to perform this WorkOS operation."
      )
    })

    it("handles NotFoundException", () => {
      const set = { status: undefined as number | undefined }
      const error = new NotFoundException({
        message: "not found",
        code: "not_found",
        requestID: "req_1",
      })
      const result = toWorkosApiError(set, error)

      expect(set.status).toBe(404)
      expect(result.error).toBe("WORKOS_NOT_FOUND")
    })

    it("handles ConflictException", () => {
      const set = { status: undefined as number | undefined }
      const error = new ConflictException({
        message: "conflict",
        code: "conflict",
        requestID: "req_1",
      })
      const result = toWorkosApiError(set, error)

      expect(set.status).toBe(409)
      expect(result.error).toBe("WORKOS_CONFLICT")
    })

    it("handles UnprocessableEntityException", () => {
      const set = { status: undefined as number | undefined }
      const error = new UnprocessableEntityException({
        message: "invalid",
        code: "unprocessable",
        requestID: "req_1",
        errors: [],
      })
      const result = toWorkosApiError(set, error)

      expect(set.status).toBe(422)
      expect(result.error).toBe("WORKOS_UNPROCESSABLE")
    })

    it("handles TenantWorkOSOperationUnsupportedError", () => {
      const set = { status: undefined as number | undefined }
      const error = new TenantWorkOSOperationUnsupportedError("testOp")
      const result = toWorkosApiError(set, error)

      expect(set.status).toBe(501)
      expect(result.error).toBe("WORKOS_OPERATION_UNSUPPORTED")
      expect(result.message).toContain("testOp")
    })

    it("returns fallback error for unknown errors", () => {
      const set = { status: undefined as number | undefined }
      const error = new Error("unknown")
      const result = toWorkosApiError(set, error, {
        fallbackError: "CUSTOM_FALLBACK",
        fallbackMessage: "Custom fallback message",
      })

      expect(set.status).toBe(500)
      expect(result.error).toBe("CUSTOM_FALLBACK")
      expect(result.message).toBe("Custom fallback message")
    })

    it("returns default fallback when no defaults provided", () => {
      const set = { status: undefined as number | undefined }
      const error = new Error("unknown")
      const result = toWorkosApiError(set, error)

      expect(set.status).toBe(500)
      expect(result.error).toBe("WORKOS_REQUEST_FAILED")
      expect(result.message).toBe(
        "Unable to complete this tenant operation right now."
      )
    })
  })

  describe("isTenantApiError", () => {
    it("returns true for valid error object", () => {
      expect(
        isTenantApiError({
          ok: false,
          error: "SOME_ERROR",
          message: "some message",
        })
      ).toBe(true)
    })

    it("returns false for success object", () => {
      expect(isTenantApiError({ ok: true })).toBe(false)
    })

    it("returns false for null", () => {
      expect(isTenantApiError(null)).toBe(false)
    })

    it("returns false for non-object", () => {
      expect(isTenantApiError("string")).toBe(false)
    })

    it("returns false when error is not string", () => {
      expect(
        isTenantApiError({ ok: false, error: 123, message: "msg" })
      ).toBe(false)
    })

    it("returns false when message is not string", () => {
      expect(
        isTenantApiError({ ok: false, error: "ERR", message: 123 })
      ).toBe(false)
    })
  })
})
