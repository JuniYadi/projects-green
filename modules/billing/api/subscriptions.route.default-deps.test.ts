import { beforeEach, describe, expect, it, mock } from "bun:test"

// Mock leaf dependencies before any other imports
mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mock(async () => ({
    user: { id: "user_1", email: "owner@example.com" },
    organizationId: "org_1",
    role: "user_owner",
    roles: ["user_owner"],
    accessToken: "mock_token",
    impersonator: null,
    sessionId: "mock_session",
    enterprise: null,
  })),
}))

const mockFindUnique = mock(async () => ({ tenantId: "tenant_1" }))
const mockFindMany = mock(async () => [])

mock.module("@/lib/prisma", () => ({
  prisma: {
    billingAccount: {
      findUnique: mockFindUnique,
    },
    subscription: {
      findMany: mockFindMany,
    },
  },
}))

const { createBillingSubscriptionsRoutes } = await import("./subscriptions.route")

describe("billing subscriptions default deps", () => {
  beforeEach(() => {
    mock.clearAllMocks()
  })

  it("uses default authenticate from withAuth", async () => {
    const { Elysia } = await import("elysia")
    const app = new Elysia().use(createBillingSubscriptionsRoutes())

    const response = await app.handle(
      new Request("http://localhost/subscriptions"),
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.subscriptions).toEqual([])
  })

  it("returns subscriptions with default deps", async () => {
    const { Elysia } = await import("elysia")
    const app = new Elysia().use(createBillingSubscriptionsRoutes())

    const response = await app.handle(
      new Request("http://localhost/subscriptions"),
    )

    expect(response.status).toBe(200)
  })
})
