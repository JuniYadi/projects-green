import { describe, it, expect, mock } from "bun:test"

// Build mock error classes and register them before anything else
class MockException extends Error {
  constructor(payload: unknown) {
    super(typeof payload === "string" ? payload : "")
  }
}

const MockBadRequestException = class BadRequestException extends MockException {
  name = "BadRequestException" as const
}
const MockUnauthorizedException = class UnauthorizedException extends MockException {
  name = "UnauthorizedException" as const
}
const MockNotFoundException = class NotFoundException extends MockException {
  name = "NotFoundException" as const
}
const MockConflictException = class ConflictException extends MockException {
  name = "ConflictException" as const
}
const MockUnprocessableEntityException = class UnprocessableEntityException extends MockException {
  name = "UnprocessableEntityException" as const
}

mock.module("@workos-inc/node", () => ({
  BadRequestException: MockBadRequestException,
  UnauthorizedException: MockUnauthorizedException,
  NotFoundException: MockNotFoundException,
  ConflictException: MockConflictException,
  UnprocessableEntityException: MockUnprocessableEntityException,
}))

const { toWorkosError } = await import("./admin.errors")

describe("toWorkosError", () => {
  it("maps BadRequestException to 400", () => {
    const set: { status?: number } = {}
    const error = new MockBadRequestException("Bad request message")

    const result = toWorkosError(set, error)

    expect(set.status).toBe(400)
    expect(result).toEqual({
      ok: false,
      error: "WORKOS_BAD_REQUEST",
      message: "Bad request message",
    })
  })

  it("maps UnauthorizedException to 401", () => {
    const set: { status?: number } = {}
    const error = new MockUnauthorizedException("Unauthorized message")

    const result = toWorkosError(set, error)

    expect(set.status).toBe(401)
    expect(result).toEqual({
      ok: false,
      error: "WORKOS_UNAUTHORIZED",
      message: "Unauthorized message",
    })
  })

  it("maps NotFoundException to 404", () => {
    const set: { status?: number } = {}
    const error = new MockNotFoundException("Not found message")

    const result = toWorkosError(set, error)

    expect(set.status).toBe(404)
    expect(result).toEqual({
      ok: false,
      error: "WORKOS_NOT_FOUND",
      message: "Not found message",
    })
  })

  it("maps ConflictException to 409", () => {
    const set: { status?: number } = {}
    const error = new MockConflictException("Conflict message")

    const result = toWorkosError(set, error)

    expect(set.status).toBe(409)
    expect(result).toEqual({
      ok: false,
      error: "WORKOS_CONFLICT",
      message: "Conflict message",
    })
  })

  it("maps UnprocessableEntityException to 422", () => {
    const set: { status?: number } = {}
    const error = new MockUnprocessableEntityException("Unprocessable message")

    const result = toWorkosError(set, error)

    expect(set.status).toBe(422)
    expect(result).toEqual({
      ok: false,
      error: "WORKOS_UNPROCESSABLE",
      message: "Unprocessable message",
    })
  })

  it("maps unknown errors to 500", () => {
    const set: { status?: number } = {}
    const error = new Error("Something unexpected happened")

    const result = toWorkosError(set, error)

    expect(set.status).toBe(500)
    expect(result).toEqual({
      ok: false,
      error: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
    })
  })

  it("handles non-Error objects", () => {
    const set: { status?: number } = {}
    const error = "just a string"

    const result = toWorkosError(set, error)

    expect(set.status).toBe(500)
    expect(result).toEqual({
      ok: false,
      error: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
    })
  })
})
