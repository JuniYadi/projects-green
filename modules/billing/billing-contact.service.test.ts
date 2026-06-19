import { beforeEach, describe, expect, it, vi } from "bun:test"
import { mock } from "bun:test"

const mockTx = {
  billingAccount: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
    findFirst: vi.fn(),
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

const {
  getOrCreateAccountWithContacts,
  addBillingContact,
  updateBillingContact,
  deactivateBillingContact,
  updatePreferredCurrency,
} = await import("./billing-account.service")

describe("getOrCreateAccountWithContacts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns existing account with contacts when contacts exist", async () => {
    const existingAccount = {
      id: "ba_1",
      organizationId: "org_123",
      contacts: [
        {
          id: "bc_1",
          billingAccountId: "ba_1",
          email: "owner@example.com",
          name: "Owner",
          role: "OWNER" as const,
          notifyOnInvoice: true,
          notifyOnLowBalance: true,
          notifyOnSupport: true,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    }

    mockTx.billingAccount.upsert.mockResolvedValue(existingAccount)

    const result = await getOrCreateAccountWithContacts({
      organizationId: "org_123",
      userEmail: "owner@example.com",
    })

    expect(result.id).toBe("ba_1")
    expect(result.contacts).toHaveLength(1)
    expect(result.contacts[0].email).toBe("owner@example.com")
  })

  it("creates OWNER contact on first access when no contacts exist", async () => {
    const accountWithoutContacts = {
      id: "ba_1",
      organizationId: "org_123",
      contacts: [],
    }

    const accountWithOwnerContact = {
      ...accountWithoutContacts,
      contacts: [
        {
          id: "bc_1",
          billingAccountId: "ba_1",
          email: "owner@example.com",
          name: "Organization Owner",
          role: "OWNER" as const,
          notifyOnInvoice: true,
          notifyOnLowBalance: true,
          notifyOnSupport: true,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    }

    mockTx.billingAccount.upsert.mockResolvedValue(accountWithoutContacts)
    mockTx.billingAccount.findUniqueOrThrow.mockResolvedValue(
      accountWithOwnerContact
    )
    mockTx.billingContact.create.mockResolvedValue({
      id: "bc_1",
      billingAccountId: "ba_1",
      email: "owner@example.com",
      name: "Organization Owner",
      role: "OWNER" as const,
      notifyOnInvoice: true,
      notifyOnLowBalance: true,
      notifyOnSupport: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const result = await getOrCreateAccountWithContacts({
      organizationId: "org_123",
      userEmail: "owner@example.com",
    })

    expect(mockTx.billingContact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "owner@example.com",
        role: "OWNER",
        name: "Organization Owner",
      }),
    })
    expect(result.contacts).toHaveLength(1)
    expect(result.contacts[0].role).toBe("OWNER")
  })
})

describe("addBillingContact", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates a new billing contact", async () => {
    const newContact = {
      id: "bc_2",
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
    }

    mockTx.billingContact.create.mockResolvedValue(newContact)

    const result = await addBillingContact({
      billingAccountId: "ba_1",
      email: "finance@example.com",
      name: "Finance Team",
      role: "FINANCE",
      notifyOnInvoice: true,
      notifyOnLowBalance: true,
      notifyOnSupport: true,
    })

    expect(result.email).toBe("finance@example.com")
    expect(result.role).toBe("FINANCE")
    expect(mockTx.billingContact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        billingAccountId: "ba_1",
        email: "finance@example.com",
        name: "Finance Team",
        role: "FINANCE",
      }),
    })
  })

  it("uses default values when optional params not provided", async () => {
    const contact = {
      id: "bc_3",
      billingAccountId: "ba_1",
      email: "acc@example.com",
      name: null,
      role: "GENERAL" as const,
      notifyOnInvoice: true,
      notifyOnLowBalance: true,
      notifyOnSupport: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    mockTx.billingContact.create.mockResolvedValue(contact)

    const result = await addBillingContact({
      billingAccountId: "ba_1",
      email: "acc@example.com",
    })

    expect(result.role).toBe("GENERAL")
    expect(mockTx.billingContact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        role: "GENERAL",
        notifyOnInvoice: true,
        notifyOnLowBalance: true,
        notifyOnSupport: true,
      }),
    })
  })
})

describe("updateBillingContact", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("updates name for non-OWNER contact", async () => {
    const existingContact = {
      id: "bc_2",
      billingAccountId: "ba_1",
      email: "finance@example.com",
      name: "Finance",
      role: "FINANCE" as const,
      notifyOnInvoice: true,
      notifyOnLowBalance: true,
      notifyOnSupport: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const updatedContact = { ...existingContact, name: "Finance Team Updated" }

    mockTx.billingContact.findFirst.mockResolvedValue(existingContact)
    mockTx.billingContact.update.mockResolvedValue(updatedContact)

    const result = await updateBillingContact("ba_1", "bc_2", {
      name: "Finance Team Updated",
    })

    expect(result.name).toBe("Finance Team Updated")
    expect(mockTx.billingContact.update).toHaveBeenCalledWith({
      where: { id: "bc_2" },
      data: { name: "Finance Team Updated" },
    })
  })

  it("allows notification toggle updates for OWNER contact", async () => {
    const ownerContact = {
      id: "bc_1",
      billingAccountId: "ba_1",
      email: "owner@example.com",
      name: "Owner",
      role: "OWNER" as const,
      notifyOnInvoice: true,
      notifyOnLowBalance: true,
      notifyOnSupport: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const updatedContact = { ...ownerContact, notifyOnInvoice: false }

    mockTx.billingContact.findFirst.mockResolvedValue(ownerContact)
    mockTx.billingContact.update.mockResolvedValue(updatedContact)

    // Should not throw - notification toggles are allowed for OWNER
    const result = await updateBillingContact("ba_1", "bc_1", {
      notifyOnInvoice: false,
    })

    expect(result.notifyOnInvoice).toBe(false)
    expect(mockTx.billingContact.update).toHaveBeenCalledWith({
      where: { id: "bc_1" },
      data: { notifyOnInvoice: false },
    })
  })

  it("throws CONTACT_NOT_FOUND for unknown contact", async () => {
    mockTx.billingContact.findFirst.mockResolvedValue(null)

    await expect(
      updateBillingContact("ba_1", "bc_unknown", { name: "New Name" })
    ).rejects.toThrow("CONTACT_NOT_FOUND")
  })
})

describe("deactivateBillingContact", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("deactivates a non-OWNER contact", async () => {
    const financeContact = {
      id: "bc_2",
      billingAccountId: "ba_1",
      email: "finance@example.com",
      name: "Finance",
      role: "FINANCE" as const,
      isActive: true,
    }

    mockTx.billingContact.findFirst.mockResolvedValue(financeContact)
    mockTx.billingContact.update.mockResolvedValue({
      ...financeContact,
      isActive: false,
    })

    await deactivateBillingContact("ba_1", "bc_2")

    expect(mockTx.billingContact.update).toHaveBeenCalledWith({
      where: { id: "bc_2" },
      data: { isActive: false },
    })
  })

  it("throws OWNER_PROTECTED for OWNER contact", async () => {
    const ownerContact = {
      id: "bc_1",
      billingAccountId: "ba_1",
      email: "owner@example.com",
      role: "OWNER" as const,
      isActive: true,
    }

    mockTx.billingContact.findFirst.mockResolvedValue(ownerContact)

    await expect(deactivateBillingContact("ba_1", "bc_1")).rejects.toThrow(
      "OWNER_PROTECTED"
    )
  })

  it("throws CONTACT_NOT_FOUND for unknown contact", async () => {
    mockTx.billingContact.findFirst.mockResolvedValue(null)

    await expect(
      deactivateBillingContact("ba_1", "bc_unknown")
    ).rejects.toThrow("CONTACT_NOT_FOUND")
  })
})

describe("updatePreferredCurrency", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("updates preferred currency when no invoices exist", async () => {
    const account = {
      id: "ba_1",
      organizationId: "org_123",
      preferredCurrency: "IDR" as const,
    }

    mockTx.billingAccount.findUnique.mockResolvedValue(account)
    mockTx.billingInvoice.count.mockResolvedValue(0)
    mockTx.billingAccount.update.mockResolvedValue({
      ...account,
      preferredCurrency: "USD" as const,
    })

    const result = await updatePreferredCurrency("org_123", "USD")

    expect(result.preferredCurrency).toBe("USD")
    expect(mockTx.billingAccount.update).toHaveBeenCalledWith({
      where: { organizationId: "org_123" },
      data: { currency: "USD", preferredCurrency: "USD" },
    })
  })

  it("throws BILLING_CURRENCY_LOCKED when invoices exist", async () => {
    const account = {
      id: "ba_1",
      organizationId: "org_123",
      preferredCurrency: "IDR" as const,
    }

    mockTx.billingAccount.findUnique.mockResolvedValue(account)
    mockTx.billingInvoice.count.mockResolvedValue(3)

    await expect(updatePreferredCurrency("org_123", "USD")).rejects.toThrow(
      "BILLING_CURRENCY_LOCKED"
    )
  })
})
