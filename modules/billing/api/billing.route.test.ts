import { describe, it, expect, mock, beforeEach, vi } from "bun:test"
import { Elysia } from "elysia"
import { MockAuthContext } from "@/test/helpers/test-auth"

// ─── Prisma mock ─────────────────────────────────────────────────────────────

const mockTx = {
  billingAccount: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
  },
  billingContact: {
    create: vi.fn(),
    update: vi.fn(),
    findFirst: vi.fn(),
  },
  billingInvoice: {
    count: vi.fn(),
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockTx,
}))

const { createBillingRoutes } = await import("./billing.route")

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockContact = (overrides: Record<string, unknown> = {}) => ({
  id: "bc_1",
  billingAccountId: "ba_1",
  email: "finance@example.com",
  name: "Finance Team",
  role: "FINANCE" as const,
  notifyOnInvoice: true,
  notifyOnLowBalance: true,
  notifyOnSupport: true,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const mockAccountWithContacts = (contacts: Array<Record<string, unknown>> = []) => ({
  id: "ba_1",
  organizationId: "org_1",
  tenantId: null,
  preferredCurrency: "IDR" as const,
  timezone: "UTC",
  status: "ACTIVE" as const,
  balance: { toNumber: () => 100000 },
  createdAt: new Date(),
  updatedAt: new Date(),
  contacts: contacts.map(mockContact),
})

const ownerContact = () => mockContact({
  id: "bc_owner",
  email: "owner@example.com",
  name: "Organization Owner",
  role: "OWNER" as const,
})

// ─── Tests ────────────────────────────────────────────────────────────────────

function resetMocks() {
  for (const model of Object.values(mockTx)) {
    for (const method of Object.values(model)) {
      if (typeof method === "function") {
        method.mockReset()
      }
    }
  }
}

describe("GET /account/detail", () => {
  beforeEach(() => {
    resetMocks()
  })

  it("returns billing account with contacts", async () => {
    const account = mockAccountWithContacts([ownerContact()])
    mockTx.billingAccount.upsert.mockResolvedValue(account)
    mockTx.billingAccount.findUniqueOrThrow.mockResolvedValue(account)

    const app = new Elysia().use(
      createBillingRoutes({
        authenticate: async () => ({
          user: { id: "user_1", email: "owner@example.com" },
          organizationId: "org_1",
        } as MockAuthContext),
      }),
    )

    const response = await app.handle(
      new Request("http://localhost/account/detail"),
    )
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.organizationId).toBe("org_1")
    expect(body.preferredCurrency).toBe("IDR")
    expect(body.contacts).toHaveLength(1)
    expect(body.contacts[0].role).toBe("OWNER")
  })

  it("auto-creates OWNER contact on first access", async () => {
    // First upsert returns account with no contacts
    const emptyAccount = mockAccountWithContacts([])
    mockTx.billingAccount.upsert.mockResolvedValue(emptyAccount)

    // After creating owner contact, refetch returns account with owner
    const accountWithOwner = mockAccountWithContacts([ownerContact()])
    mockTx.billingAccount.findUniqueOrThrow.mockResolvedValue(accountWithOwner)
    mockTx.billingContact.create.mockResolvedValue(ownerContact())

    const app = new Elysia().use(
      createBillingRoutes({
        authenticate: async () => ({
          user: { id: "user_1", email: "owner@example.com" },
          organizationId: "org_1",
        } as MockAuthContext),
      }),
    )

    const response = await app.handle(
      new Request("http://localhost/account/detail"),
    )
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.contacts).toHaveLength(1)
    expect(body.contacts[0].role).toBe("OWNER")
    expect(body.contacts[0].email).toBe("owner@example.com")
    expect(mockTx.billingContact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: "owner@example.com", role: "OWNER" }),
      }),
    )
  })

  it("returns 401 when unauthenticated", async () => {
    const app = new Elysia().use(
      createBillingRoutes({
        authenticate: async () => ({ user: null } as MockAuthContext),
      }),
    )

    const response = await app.handle(
      new Request("http://localhost/account/detail"),
    )
    expect(response.status).toBe(401)

    const body = await response.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe("UNAUTHORIZED")
  })

  it("returns 403 when no organization", async () => {
    const app = new Elysia().use(
      createBillingRoutes({
        authenticate: async () => ({
          user: { id: "user_1" },
          organizationId: null,
        } as MockAuthContext),
      }),
    )

    const response = await app.handle(
      new Request("http://localhost/account/detail"),
    )
    expect(response.status).toBe(403)

    const body = await response.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe("NO_ORGANIZATION")
  })

  it("returns 500 on internal error", async () => {
    mockTx.billingAccount.upsert.mockRejectedValue(new Error("DB_ERROR"))

    const app = new Elysia().use(
      createBillingRoutes({
        authenticate: async () => ({
          user: { id: "user_1", email: "owner@example.com" },
          organizationId: "org_1",
        } as MockAuthContext),
      }),
    )

    const response = await app.handle(
      new Request("http://localhost/account/detail"),
    )
    expect(response.status).toBe(500)

    const body = await response.json()
    expect(body.error).toBe("INTERNAL_ERROR")
  })
})

describe("POST /contacts", () => {
  beforeEach(() => {
    resetMocks()
  })

  it("adds a new billing contact", async () => {
    const account = mockAccountWithContacts([ownerContact()])
    mockTx.billingAccount.upsert.mockResolvedValue(account)
    mockTx.billingContact.create.mockResolvedValue(mockContact())

    const app = new Elysia().use(
      createBillingRoutes({
        authenticate: async () => ({
          user: { id: "user_1", email: "owner@example.com" },
          organizationId: "org_1",
        } as MockAuthContext),
      }),
    )

    const response = await app.handle(
      new Request("http://localhost/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "finance@example.com",
          name: "Finance Team",
          role: "FINANCE",
        }),
      }),
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.email).toBe("finance@example.com")
    expect(body.role).toBe("FINANCE")
  })

  it("returns 409 for duplicate email", async () => {
    const existingContact = mockContact()
    const account = mockAccountWithContacts([existingContact])
    mockTx.billingAccount.upsert.mockResolvedValue(account)

    const app = new Elysia().use(
      createBillingRoutes({
        authenticate: async () => ({
          user: { id: "user_1", email: "owner@example.com" },
          organizationId: "org_1",
        } as MockAuthContext),
      }),
    )

    const response = await app.handle(
      new Request("http://localhost/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "finance@example.com",
          role: "FINANCE",
        }),
      }),
    )

    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error).toBe("DUPLICATE_EMAIL")
  })

  it("returns 400 for invalid email", async () => {
    const app = new Elysia().use(
      createBillingRoutes({
        authenticate: async () => ({
          user: { id: "user_1", email: "owner@example.com" },
          organizationId: "org_1",
        } as MockAuthContext),
      }),
    )

    const response = await app.handle(
      new Request("http://localhost/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "not-an-email",
          role: "FINANCE",
        }),
      }),
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe("VALIDATION_ERROR")
  })

  it("returns 401 when unauthenticated", async () => {
    const app = new Elysia().use(
      createBillingRoutes({
        authenticate: async () => ({ user: null } as MockAuthContext),
      }),
    )

    const response = await app.handle(
      new Request("http://localhost/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "new@example.com" }),
      }),
    )

    expect(response.status).toBe(401)
  })

  it("returns 500 on internal error", async () => {
    const account = mockAccountWithContacts([ownerContact()])
    mockTx.billingAccount.upsert.mockResolvedValue(account)
    mockTx.billingContact.create.mockRejectedValue(new Error("DB_ERROR"))

    const app = new Elysia().use(
      createBillingRoutes({
        authenticate: async () => ({
          user: { id: "user_1", email: "owner@example.com" },
          organizationId: "org_1",
        } as MockAuthContext),
      }),
    )

    const response = await app.handle(
      new Request("http://localhost/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "new@example.com", role: "FINANCE" }),
      }),
    )

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe("INTERNAL_ERROR")
  })
})

describe("PATCH /contacts/:contactId", () => {
  beforeEach(() => {
    resetMocks()
  })

  it("updates a non-OWNER contact name", async () => {
    const contact = mockContact()
    mockTx.billingContact.findFirst.mockResolvedValue(contact)
    mockTx.billingContact.update.mockResolvedValue({ ...contact, name: "Updated Finance" })

    const app = new Elysia().use(
      createBillingRoutes({
        authenticate: async () => ({
          user: { id: "user_1", email: "owner@example.com" },
          organizationId: "org_1",
        } as MockAuthContext),
      }),
    )

    const response = await app.handle(
      new Request("http://localhost/contacts/bc_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Finance" }),
      }),
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.name).toBe("Updated Finance")
  })

  it("returns 404 when contact not found", async () => {
    mockTx.billingContact.findFirst.mockResolvedValue(null)

    const app = new Elysia().use(
      createBillingRoutes({
        authenticate: async () => ({
          user: { id: "user_1", email: "owner@example.com" },
          organizationId: "org_1",
        } as MockAuthContext),
      }),
    )

    const response = await app.handle(
      new Request("http://localhost/contacts/bc_unknown", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Name" }),
      }),
    )

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe("NOT_FOUND")
  })

  it("returns 400 for invalid body fields", async () => {
    const app = new Elysia().use(
      createBillingRoutes({
        authenticate: async () => ({
          user: { id: "user_1", email: "owner@example.com" },
          organizationId: "org_1",
        } as MockAuthContext),
      }),
    )

    const response = await app.handle(
      new Request("http://localhost/contacts/bc_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: "not-a-boolean" }),
      }),
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe("VALIDATION_ERROR")
  })

  it("allows notification toggle for OWNER contact", async () => {
    const owner = mockContact({ id: "bc_owner", role: "OWNER" as const, email: "owner@example.com" })
    mockTx.billingContact.findFirst.mockResolvedValue(owner)
    mockTx.billingContact.update.mockResolvedValue({ ...owner, notifyOnInvoice: false })

    const app = new Elysia().use(
      createBillingRoutes({
        authenticate: async () => ({
          user: { id: "user_1", email: "owner@example.com" },
          organizationId: "org_1",
        } as MockAuthContext),
      }),
    )

    const response = await app.handle(
      new Request("http://localhost/contacts/bc_owner", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifyOnInvoice: false }),
      }),
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.notifyOnInvoice).toBe(false)
  })
})

describe("DELETE /contacts/:contactId", () => {
  beforeEach(() => {
    resetMocks()
  })

  it("deactivates a non-OWNER contact", async () => {
    const contact = mockContact()
    mockTx.billingContact.findFirst.mockResolvedValue(contact)
    mockTx.billingContact.update.mockResolvedValue({ ...contact, isActive: false })

    const app = new Elysia().use(
      createBillingRoutes({
        authenticate: async () => ({
          user: { id: "user_1", email: "owner@example.com" },
          organizationId: "org_1",
        } as MockAuthContext),
      }),
    )

    const response = await app.handle(
      new Request("http://localhost/contacts/bc_1", { method: "DELETE" }),
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(mockTx.billingContact.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "bc_1" },
        data: { isActive: false },
      }),
    )
  })

  it("returns 403 when trying to deactivate OWNER contact", async () => {
    const owner = ownerContact()
    mockTx.billingContact.findFirst.mockResolvedValue(owner)

    const app = new Elysia().use(
      createBillingRoutes({
        authenticate: async () => ({
          user: { id: "user_1", email: "owner@example.com" },
          organizationId: "org_1",
        } as MockAuthContext),
      }),
    )

    const response = await app.handle(
      new Request("http://localhost/contacts/bc_owner", { method: "DELETE" }),
    )

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe("OWNER_PROTECTED")
  })

  it("returns 404 when contact not found", async () => {
    mockTx.billingContact.findFirst.mockResolvedValue(null)

    const app = new Elysia().use(
      createBillingRoutes({
        authenticate: async () => ({
          user: { id: "user_1", email: "owner@example.com" },
          organizationId: "org_1",
        } as MockAuthContext),
      }),
    )

    const response = await app.handle(
      new Request("http://localhost/contacts/bc_unknown", { method: "DELETE" }),
    )

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe("NOT_FOUND")
  })
})

describe("PATCH /currency", () => {
  beforeEach(() => {
    resetMocks()
  })

  it("updates preferred currency when no invoices exist", async () => {
    const account = {
      id: "ba_1",
      organizationId: "org_1",
      preferredCurrency: "IDR" as const,
    }

    mockTx.billingAccount.findUnique.mockResolvedValue(account)
    mockTx.billingInvoice.count.mockResolvedValue(0)
    mockTx.billingAccount.update.mockResolvedValue({
      ...account,
      preferredCurrency: "USD",
    })

    const app = new Elysia().use(
      createBillingRoutes({
        authenticate: async () => ({
          user: { id: "user_1", email: "owner@example.com" },
          organizationId: "org_1",
        } as MockAuthContext),
      }),
    )

    const response = await app.handle(
      new Request("http://localhost/currency", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredCurrency: "USD" }),
      }),
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.preferredCurrency).toBe("USD")
  })

  it("returns 409 when invoices exist (currency locked)", async () => {
    const account = {
      id: "ba_1",
      organizationId: "org_1",
      preferredCurrency: "IDR" as const,
    }

    mockTx.billingAccount.findUnique.mockResolvedValue(account)
    mockTx.billingInvoice.count.mockResolvedValue(5)

    const app = new Elysia().use(
      createBillingRoutes({
        authenticate: async () => ({
          user: { id: "user_1", email: "owner@example.com" },
          organizationId: "org_1",
        } as MockAuthContext),
      }),
    )

    const response = await app.handle(
      new Request("http://localhost/currency", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredCurrency: "USD" }),
      }),
    )

    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error).toBe("CURRENCY_LOCKED")
  })

  it("returns 400 for invalid currency value", async () => {
    const app = new Elysia().use(
      createBillingRoutes({
        authenticate: async () => ({
          user: { id: "user_1", email: "owner@example.com" },
          organizationId: "org_1",
        } as MockAuthContext),
      }),
    )

    const response = await app.handle(
      new Request("http://localhost/currency", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredCurrency: "EUR" }),
      }),
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe("VALIDATION_ERROR")
  })

  it("returns 404 when billing account not found", async () => {
    mockTx.billingAccount.findUnique.mockResolvedValue(null)

    const app = new Elysia().use(
      createBillingRoutes({
        authenticate: async () => ({
          user: { id: "user_1", email: "owner@example.com" },
          organizationId: "org_1",
        } as MockAuthContext),
      }),
    )

    const response = await app.handle(
      new Request("http://localhost/currency", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredCurrency: "USD" }),
      }),
    )

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe("NOT_FOUND")
  })
})

describe("auth guard (shared across endpoints)", () => {
  beforeEach(() => {
    resetMocks()
  })

  it("returns 401 for unauthenticated POST /contacts", async () => {
    const app = new Elysia().use(
      createBillingRoutes({
        authenticate: async () => ({ user: null } as MockAuthContext),
      }),
    )

    for (const [method, url, body] of [
      ["POST", "/contacts", JSON.stringify({ email: "x@y.com" })],
      ["DELETE", "/contacts/bc_1", undefined],
      ["PATCH", "/currency", JSON.stringify({ preferredCurrency: "USD" })],
    ] as const) {
      const response = await app.handle(
        new Request(`http://localhost${url}`, {
          method,
          headers: body ? { "Content-Type": "application/json" } : undefined,
          body,
        }),
      )

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe("UNAUTHORIZED")
    }
  })

  it("returns 403 when no organization", async () => {
    const app = new Elysia().use(
      createBillingRoutes({
        authenticate: async () => ({
          user: { id: "user_1" },
          organizationId: null,
        } as MockAuthContext),
      }),
    )

    for (const [method, url, body] of [
      ["POST", "/contacts", JSON.stringify({ email: "x@y.com" })],
      ["DELETE", "/contacts/bc_1", undefined],
      ["PATCH", "/currency", JSON.stringify({ preferredCurrency: "USD" })],
    ] as const) {
      const response = await app.handle(
        new Request(`http://localhost${url}`, {
          method,
          headers: body ? { "Content-Type": "application/json" } : undefined,
          body,
        }),
      )

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBe("NO_ORGANIZATION")
    }
  })
})
