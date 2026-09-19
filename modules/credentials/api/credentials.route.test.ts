mock.module("server-only", () => ({}))

import { describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

const mockListCredentials = mock(async () => {
  throw new Error("Prisma error: appCredential.findMany is not a function")
})

const mockWithAuth = mock(async () => ({
  user: { id: "user_1", email: "test@example.com" },
  organizationId: "org_1",
  role: "admin",
}))

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mockWithAuth,
}))

const mockDeleteCredential = mock(async () => ({ count: 1 }))
const mockRevokeCredential = mock(async () => ({ count: 1 }))

mock.module("@/modules/credentials/app-credential.service", () => ({
  listCredentials: mockListCredentials,
  createCredential: mock(async () => ({ id: "cred_1" })),
  deleteCredential: mockDeleteCredential,
  revokeCredential: mockRevokeCredential,
}))
// Dynamic import required so mock.module takes effect before module evaluation in Bun
const { credentialsRoutes } = await import("./credentials.route")

describe("credentialsRoutes", () => {
  describe("GET /app/credentials", () => {
    it("returns safe error when listCredentials throws", async () => {
      const app = new Elysia().use(credentialsRoutes)

      const res = await app.handle(
        new Request("http://localhost/app/credentials")
      )

      const body = await res.json()

      expect(body).toEqual({
        ok: false,
        error: "Unable to load credentials. Please try again.",
      })
    })
  })

  it("returns 401 when user is unauthenticated", async () => {
    mockWithAuth.mockResolvedValueOnce({
      user: null,
      organizationId: null,
    } as never)
    const app = new Elysia().use(credentialsRoutes)

    const res = await app.handle(
      new Request("http://localhost/app/credentials")
    )

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({ ok: false, error: "UNAUTHORIZED" })
  })

  it("returns 403 when organization is missing", async () => {
    mockWithAuth.mockResolvedValueOnce({
      user: { id: "user_1", email: "test@example.com" },
      organizationId: null,
    } as never)
    const app = new Elysia().use(credentialsRoutes)

    const res = await app.handle(
      new Request("http://localhost/app/credentials")
    )

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body).toEqual({ ok: false, error: "FORBIDDEN" })
  })
})

describe("DELETE /app/credentials/:id", () => {
  it("returns 403 when non-admin member attempts to delete", async () => {
    mockWithAuth.mockResolvedValueOnce({
      user: { id: "user_1", email: "test@example.com" },
      organizationId: "org_1",
      role: "member",
    } as never)
    const app = new Elysia().use(credentialsRoutes)

    const res = await app.handle(
      new Request("http://localhost/app/credentials/cred_1", {
        method: "DELETE",
      })
    )

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe("FORBIDDEN")
  })

  it("returns 404 when credential to delete does not exist", async () => {
    mockDeleteCredential.mockResolvedValueOnce({ count: 0 })
    const app = new Elysia().use(credentialsRoutes)

    const res = await app.handle(
      new Request("http://localhost/app/credentials/non_existent", {
        method: "DELETE",
      })
    )

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body).toEqual({
      ok: false,
      error: "NOT_FOUND",
      message: "Credential not found",
    })
  })

  it("returns 200 when admin deletes existing credential", async () => {
    mockDeleteCredential.mockResolvedValueOnce({ count: 1 })
    const app = new Elysia().use(credentialsRoutes)

    const res = await app.handle(
      new Request("http://localhost/app/credentials/cred_1", {
        method: "DELETE",
      })
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true })
  })
})

describe("POST /app/credentials/:id/revoke", () => {
  it("returns 404 when credential to revoke does not exist", async () => {
    mockRevokeCredential.mockResolvedValueOnce({ count: 0 })
    const app = new Elysia().use(credentialsRoutes)

    const res = await app.handle(
      new Request("http://localhost/app/credentials/non_existent/revoke", {
        method: "POST",
      })
    )

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body).toEqual({
      ok: false,
      error: "NOT_FOUND",
      message: "Credential not found",
    })
  })
})
