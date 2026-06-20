import { beforeEach, describe, expect, it, mock } from "bun:test"
import { TestDecimal as Decimal } from "@/test/helpers/prisma-mock"

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
  getWorkOS: mock(() => ({
    organizations: {
      getOrganization: mock(async (orgId: string) => ({
        id: orgId,
        name: "Example Organization",
        metadata: {
          billing_full_name: "Test User",
          billing_address: "123 Test St",
          billing_city: "Jakarta",
          billing_state: "DKI Jakarta",
          billing_country: "Indonesia",
          billing_post_code: "12345",
        },
      })),
    },
  })),
}))

const mockAccountRecord = {
  id: "acc_1",
  organizationId: "org_1",
  balance: new Decimal(100000),
  currency: "IDR",
  preferredCurrency: "IDR",
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockFindUnique = mock(async () => mockAccountRecord)
const mockCreate = mock(async () => mockAccountRecord)

const mockTx = {
  billingAccount: {
    findUnique: mockFindUnique,
    create: mockCreate,
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: {
    $transaction: mock(async (fn: (tx: typeof mockTx) => unknown) =>
      fn(mockTx)
    ),
    billingAccount: {
      findUnique: mockFindUnique,
    },
  },
}))

const { createBillingAccountRoutes } = await import("./account.route")

describe("billing account default deps", () => {
  beforeEach(() => {
    mock.clearAllMocks()
  })

  it("uses default authenticate from withAuth", async () => {
    const { Elysia } = await import("elysia")
    const app = new Elysia().use(createBillingAccountRoutes())

    const response = await app.handle(new Request("http://localhost/account"))

    // withAuth mocked to return user -> should try to process
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.organizationId).toBe("org_1")
  })

  it("default getOrganizationAction calls workos getOrganization", async () => {
    const { Elysia } = await import("elysia")
    const app = new Elysia().use(createBillingAccountRoutes())

    const response = await app.handle(new Request("http://localhost/account"))

    // Should succeed with mocked WorkOS
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.balanceIdr).toBe("100000.00")
    expect(body.formattedBalance).toContain("IDR")
  })
})
