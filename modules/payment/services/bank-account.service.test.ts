import { describe, it, expect, beforeEach, mock } from "bun:test"

// Mock prisma with bankAccount model
const mockBankAccountFindMany = mock<
  () => Promise<Array<Record<string, unknown>>>
>(() => Promise.resolve([]))
const mockBankAccountFindUnique = mock<
  () => Promise<Record<string, unknown> | null>
>(() => Promise.resolve(null))
const mockBankAccountCreate = mock<() => Promise<Record<string, unknown>>>(() =>
  Promise.resolve({})
)
const mockBankAccountUpdate = mock<() => Promise<Record<string, unknown>>>(() =>
  Promise.resolve({})
)
const mockBankAccountUpdateMany = mock<() => Promise<{ count: number }>>(() =>
  Promise.resolve({ count: 0 })
)

mock.module("@/lib/prisma", () => ({
  prisma: {
    paymentBankAccount: {
      findMany: mockBankAccountFindMany,
      findUnique: mockBankAccountFindUnique,
      create: mockBankAccountCreate,
      update: mockBankAccountUpdate,
      updateMany: mockBankAccountUpdateMany,
    },
  },
}))

// Mock encryption service with predictable behaviour
const mockEncryptionService = {
  encryptField: (value: string) => `enc_${value}`,
  decryptFieldOptional: (value: string | null) => {
    if (!value) return null
    if (value.startsWith("enc_")) return value.slice(4)
    return value
  },
}

const { BankAccountService } = await import("./bank-account.service")

describe("BankAccountService", () => {
  let service: InstanceType<typeof BankAccountService>

  const mockAccount = {
    id: "ba_1",
    bankCode: "014",
    bankName: "BCA",
    accountName: "enc_John Doe",
    accountNumber: "enc_123456",
    currency: "IDR",
    supportedCurrencies: ["IDR"],
    swiftCode: null,
    bankAddress: null,
    isActive: true,
    isDefault: false,
    sortOrder: 1,
    createdAt: new Date("2026-01-01"),
  }

  beforeEach(() => {
    service = new BankAccountService(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockEncryptionService as any
    )

    // Reset mocks
    mockBankAccountFindMany.mockClear()
    mockBankAccountFindUnique.mockClear()
    mockBankAccountCreate.mockClear()
    mockBankAccountUpdate.mockClear()
    mockBankAccountUpdateMany.mockClear()

    // Reset default implementations
    mockBankAccountFindMany.mockImplementation(() => Promise.resolve([]))
    mockBankAccountFindUnique.mockImplementation(() => Promise.resolve(null))
    mockBankAccountCreate.mockImplementation(() => Promise.resolve({}))
    mockBankAccountUpdate.mockImplementation(() => Promise.resolve({}))
    mockBankAccountUpdateMany.mockImplementation(() =>
      Promise.resolve({ count: 0 })
    )
  })

  describe("list", () => {
    it("returns active accounts by default", async () => {
      mockBankAccountFindMany.mockImplementation(() =>
        Promise.resolve([mockAccount])
      )

      const result = await service.list()

      expect(mockBankAccountFindMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: [
          { isDefault: "desc" },
          { sortOrder: "asc" },
          { createdAt: "desc" },
        ],
      })
      expect(result).toHaveLength(1)
      expect(result[0].bankCode).toBe("014")
    })

    it("includes inactive accounts when includeInactive is true", async () => {
      mockBankAccountFindMany.mockImplementation(() => Promise.resolve([]))

      await service.list({ includeInactive: true })

      expect(mockBankAccountFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} })
      )
    })

    it("returns empty array when no accounts exist", async () => {
      const result = await service.list()
      expect(result).toEqual([])
    })
  })

  describe("findById", () => {
    it("returns account when found", async () => {
      mockBankAccountFindUnique.mockImplementation(() =>
        Promise.resolve(mockAccount)
      )

      const result = await service.findById("ba_1")

      expect(mockBankAccountFindUnique).toHaveBeenCalledWith({
        where: { id: "ba_1" },
      })
      expect(result).not.toBeNull()
      expect(result!.id).toBe("ba_1")
    })

    it("returns null when account not found", async () => {
      const result = await service.findById("nonexistent")
      expect(result).toBeNull()
    })
  })

  describe("create", () => {
    it("creates a new bank account and encrypts sensitive fields", async () => {
      const createdAccount = {
        ...mockAccount,
        id: "ba_new",
        accountName: "enc_John Doe",
        accountNumber: "enc_123456",
      }
      mockBankAccountCreate.mockImplementation(() =>
        Promise.resolve(createdAccount)
      )

      const result = await service.create({
        bankCode: "014",
        bankName: "BCA",
        accountName: "John Doe",
        accountNumber: "123456",
      })

      expect(mockBankAccountCreate).toHaveBeenCalledWith({
        data: {
          bankCode: "014",
          bankName: "BCA",
          accountName: "enc_John Doe",
          accountNumber: "enc_123456",
          currency: "IDR",
          supportedCurrencies: ["IDR"],
          swiftCode: undefined,
          bankAddress: undefined,
          isDefault: false,
          isActive: true,
        },
      })
      expect(result.bankCode).toBe("014")
      expect(result.supportedCurrencies).toEqual(["IDR"])
    })

    it("creates bank account with multiple supported currencies and international fields", async () => {
      mockBankAccountCreate.mockImplementation(() =>
        Promise.resolve({
          ...mockAccount,
          currency: "USD",
          supportedCurrencies: ["USD", "IDR"],
          swiftCode: "CENAIDJA",
          bankAddress: "1 International Plaza, Jakarta",
        })
      )

      const result = await service.create({
        bankCode: "HSBC",
        bankName: "HSBC Indonesia",
        accountName: "PT Projects Green",
        accountNumber: "987654321",
        supportedCurrencies: ["USD", "IDR"],
        swiftCode: "CENAIDJA",
        bankAddress: "1 International Plaza, Jakarta",
      })

      expect(mockBankAccountCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          currency: "USD",
          supportedCurrencies: ["USD", "IDR"],
          swiftCode: "CENAIDJA",
          bankAddress: "1 International Plaza, Jakarta",
        }),
      })
      expect(result.supportedCurrencies).toEqual(["USD", "IDR"])
      expect(result.swiftCode).toBe("CENAIDJA")
      expect(result.bankAddress).toBe("1 International Plaza, Jakarta")
    })

    it("clears existing default when new account is set as default", async () => {
      mockBankAccountCreate.mockImplementation(() =>
        Promise.resolve({
          ...mockAccount,
          id: "ba_default",
          isDefault: true,
        })
      )

      await service.create({
        bankCode: "014",
        bankName: "BCA",
        accountName: "John Doe",
        accountNumber: "123456",
        isDefault: true,
      })

      expect(mockBankAccountUpdateMany).toHaveBeenCalledWith({
        where: { isDefault: true },
        data: { isDefault: false },
      })
    })

    it("does not clear defaults when isDefault is false", async () => {
      mockBankAccountCreate.mockImplementation(() =>
        Promise.resolve({ ...mockAccount, id: "ba_nondefault" })
      )

      await service.create({
        bankCode: "014",
        bankName: "BCA",
        accountName: "John Doe",
        accountNumber: "123456",
        isDefault: false,
      })

      expect(mockBankAccountUpdateMany).not.toHaveBeenCalled()
    })
  })

  describe("update", () => {
    it("updates an existing bank account", async () => {
      mockBankAccountFindUnique.mockImplementation(() =>
        Promise.resolve(mockAccount)
      )
      mockBankAccountUpdate.mockImplementation(() =>
        Promise.resolve({
          ...mockAccount,
          bankName: "BCA Updated",
        })
      )

      const result = await service.update("ba_1", {
        bankName: "BCA Updated",
      })

      expect(mockBankAccountUpdate).toHaveBeenCalled()
      expect(result.bankName).toBe("BCA Updated")
    })

    it("throws error when account not found", async () => {
      mockBankAccountFindUnique.mockImplementation(() => Promise.resolve(null))

      expect(
        service.update("nonexistent", { bankName: "New" })
      ).rejects.toThrow("Bank account not found")
    })

    it("clears existing default when setting as default", async () => {
      const nonDefaultAccount = { ...mockAccount, isDefault: false }
      mockBankAccountFindUnique.mockImplementation(() =>
        Promise.resolve(nonDefaultAccount)
      )
      mockBankAccountUpdate.mockImplementation(() =>
        Promise.resolve({ ...nonDefaultAccount, isDefault: true })
      )

      await service.update("ba_1", { isDefault: true })

      expect(mockBankAccountUpdateMany).toHaveBeenCalledWith({
        where: { isDefault: true, id: { not: "ba_1" } },
        data: { isDefault: false },
      })
    })

    it("does not clear defaults when account is already default", async () => {
      const defaultAccount = { ...mockAccount, isDefault: true }
      mockBankAccountFindUnique.mockImplementation(() =>
        Promise.resolve(defaultAccount)
      )
      mockBankAccountUpdate.mockImplementation(() =>
        Promise.resolve(defaultAccount)
      )

      await service.update("ba_1", { isDefault: true })

      expect(mockBankAccountUpdateMany).not.toHaveBeenCalled()
    })

    it("encrypts sensitive fields on update", async () => {
      mockBankAccountFindUnique.mockImplementation(() =>
        Promise.resolve(mockAccount)
      )
      mockBankAccountUpdate.mockImplementation(() =>
        Promise.resolve({
          ...mockAccount,
          accountName: "enc_New Name",
          accountNumber: "enc_654321",
        })
      )

      await service.update("ba_1", {
        accountName: "New Name",
        accountNumber: "654321",
      })

      expect(mockBankAccountUpdate).toHaveBeenCalledWith({
        where: { id: "ba_1" },
        data: expect.objectContaining({
          accountName: "enc_New Name",
          accountNumber: "enc_654321",
        }),
      })
    })

    it("updates isActive status", async () => {
      mockBankAccountFindUnique.mockImplementation(() =>
        Promise.resolve(mockAccount)
      )
      mockBankAccountUpdate.mockImplementation(() =>
        Promise.resolve({ ...mockAccount, isActive: false })
      )

      const updated = await service.update("ba_1", { isActive: false })

      expect(updated.isActive).toBe(false)
    })

    it("updates supported currencies and international fields", async () => {
      mockBankAccountFindUnique.mockImplementation(() =>
        Promise.resolve(mockAccount)
      )
      mockBankAccountUpdate.mockImplementation(() =>
        Promise.resolve({
          ...mockAccount,
          currency: "USD",
          supportedCurrencies: ["USD"],
          swiftCode: "CENAIDJA",
          bankAddress: "1 International Plaza, Jakarta",
        })
      )

      const updated = await service.update("ba_1", {
        supportedCurrencies: ["USD"],
        swiftCode: "CENAIDJA",
        bankAddress: "1 International Plaza, Jakarta",
      })

      expect(mockBankAccountUpdate).toHaveBeenCalledWith({
        where: { id: "ba_1" },
        data: expect.objectContaining({
          currency: "USD",
          supportedCurrencies: ["USD"],
          swiftCode: "CENAIDJA",
          bankAddress: "1 International Plaza, Jakarta",
        }),
      })
      expect(updated.supportedCurrencies).toEqual(["USD"])
    })
  })

  describe("toggle", () => {
    it("toggles account from active to inactive", async () => {
      mockBankAccountFindUnique.mockImplementation(() =>
        Promise.resolve(mockAccount)
      )
      mockBankAccountUpdate.mockImplementation(() =>
        Promise.resolve({ ...mockAccount, isActive: false })
      )

      const result = await service.toggle("ba_1")

      expect(mockBankAccountUpdate).toHaveBeenCalledWith({
        where: { id: "ba_1" },
        data: { isActive: false },
      })
      expect(result.isActive).toBe(false)
    })

    it("toggles account from inactive to active", async () => {
      const inactiveAccount = { ...mockAccount, isActive: false }
      mockBankAccountFindUnique.mockImplementation(() =>
        Promise.resolve(inactiveAccount)
      )
      mockBankAccountUpdate.mockImplementation(() =>
        Promise.resolve({ ...mockAccount, isActive: true })
      )

      const result = await service.toggle("ba_1")

      expect(mockBankAccountUpdate).toHaveBeenCalledWith({
        where: { id: "ba_1" },
        data: { isActive: true },
      })
      expect(result.isActive).toBe(true)
    })

    it("throws error when account not found", async () => {
      mockBankAccountFindUnique.mockImplementation(() => Promise.resolve(null))

      expect(service.toggle("nonexistent")).rejects.toThrow(
        "Bank account not found"
      )
    })
  })

  describe("getActiveAccounts", () => {
    it("returns only active accounts", async () => {
      const accounts = [
        { ...mockAccount, id: "ba_1" },
        { ...mockAccount, id: "ba_2" },
      ]
      mockBankAccountFindMany.mockImplementation(() =>
        Promise.resolve(accounts)
      )

      const result = await service.getActiveAccounts()

      expect(mockBankAccountFindMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: [
          { isDefault: "desc" },
          { sortOrder: "asc" },
          { createdAt: "desc" },
        ],
      })
      expect(result).toHaveLength(2)
    })

    it("filters active accounts by supported currency with legacy fallback", async () => {
      const accounts = [
        {
          ...mockAccount,
          id: "ba_usd",
          currency: "IDR",
          supportedCurrencies: ["USD", "IDR"],
        },
        {
          ...mockAccount,
          id: "ba_legacy_usd",
          currency: "USD",
          supportedCurrencies: [],
        },
      ]
      mockBankAccountFindMany.mockImplementation(() =>
        Promise.resolve(accounts)
      )

      const result = await service.getActiveAccounts("USD")

      expect(mockBankAccountFindMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          OR: [
            { supportedCurrencies: { has: "USD" } },
            { supportedCurrencies: { isEmpty: true }, currency: "USD" },
          ],
        },
        orderBy: [
          { isDefault: "desc" },
          { sortOrder: "asc" },
          { createdAt: "desc" },
        ],
      })
      expect(result).toHaveLength(2)
    })
  })

  describe("response decryption", () => {
    it("decrypts account name and number in response", async () => {
      mockBankAccountFindUnique.mockImplementation(() =>
        Promise.resolve({
          ...mockAccount,
          accountName: "enc_John Doe",
          accountNumber: "enc_123456",
        })
      )

      const result = await service.findById("ba_1")

      expect(result!.accountName).toBe("John Doe")
      expect(result!.accountNumber).toBe("123456")
    })

    it("returns empty string for null encrypted fields", async () => {
      mockBankAccountFindUnique.mockImplementation(() =>
        Promise.resolve({
          ...mockAccount,
          accountName: null,
          accountNumber: null,
        })
      )

      const result = await service.findById("ba_1")

      expect(result!.accountName).toBe("")
      expect(result!.accountNumber).toBe("")
    })
  })
})
