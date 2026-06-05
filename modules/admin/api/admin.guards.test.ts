import { describe, expect, it, mock } from "bun:test"

describe("adminGuards", () => {
  it("toUnauthorizedError sets status to 401", async () => {
    const { toUnauthorizedError } = await import("./admin.guards")
    const set: { status?: number } = {}
    const result = toUnauthorizedError(set)

    expect(set.status).toBe(401)
    expect(result).toEqual({
      ok: false,
      error: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    })
  })

  it("toForbiddenError sets status to 403", async () => {
    const { toForbiddenError } = await import("./admin.guards")
    const set: { status?: number } = {}
    const result = toForbiddenError(set)

    expect(set.status).toBe(403)
    expect(result).toEqual({
      ok: false,
      error: "FORBIDDEN",
      policyCode: "SUPER_ADMIN_REQUIRED",
      message: "This action requires super admin access.",
    })
  })
})
