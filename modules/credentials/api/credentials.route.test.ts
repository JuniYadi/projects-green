import { describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

const mockListCredentials = mock(async () => {
  throw new Error("Prisma error: appCredential.findMany is not a function")
})

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mock(async () => ({
    user: { id: "user_1", email: "test@example.com" },
    organizationId: "org_1",
  })),
}))

mock.module("@/modules/credentials/app-credential.service", () => ({
  listCredentials: mockListCredentials,
  createCredential: mock(async () => ({})),
  deleteCredential: mock(async () => {}),
  revokeCredential: mock(async () => {}),
}))

import { credentialsRoutes } from "./credentials.route"

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
})
