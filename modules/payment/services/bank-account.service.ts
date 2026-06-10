import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { EncryptionService } from "./encryption.service"
import type { BankAccountResponse } from "@/modules/payment/types/payment.types"

type BankAccountInput = {
  bankCode: string
  bankName: string
  accountName: string
  accountNumber: string
  currency?: string
  supportedCurrencies?: string[]
  swiftCode?: string | null
  bankAddress?: string | null
  isDefault?: boolean
}

export class BankAccountService {
  private encryption: EncryptionService

  constructor(encryption?: EncryptionService) {
    const key = process.env.ENCRYPTION_KEY || ""
    this.encryption = encryption || new EncryptionService(key)
  }

  async list(
    options: { includeInactive?: boolean } = {}
  ): Promise<BankAccountResponse[]> {
    const where = options.includeInactive ? {} : { isActive: true }
    const accounts = await prisma.bankAccount.findMany({
      where,
      orderBy: [
        { isDefault: "desc" },
        { sortOrder: "asc" },
        { createdAt: "desc" },
      ],
    })

    return accounts.map((account) => this.toResponse(account))
  }

  async findById(id: string): Promise<BankAccountResponse | null> {
    const account = await prisma.bankAccount.findUnique({ where: { id } })
    if (!account) return null
    return this.toResponse(account)
  }

  async create(input: BankAccountInput): Promise<BankAccountResponse> {
    if (input.isDefault) {
      await prisma.bankAccount.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      })
    }

    const supportedCurrencies = this.resolveSupportedCurrencies(input)

    const account = await prisma.bankAccount.create({
      data: {
        bankCode: input.bankCode,
        bankName: input.bankName,
        accountName: this.encryption.encryptField(input.accountName),
        accountNumber: this.encryption.encryptField(input.accountNumber),
        currency: supportedCurrencies[0],
        supportedCurrencies,
        swiftCode: input.swiftCode ?? undefined,
        bankAddress: input.bankAddress ?? undefined,
        isDefault: input.isDefault || false,
        isActive: true,
      },
    })

    return this.toResponse(account)
  }

  async update(
    id: string,
    input: Partial<BankAccountInput> & { isActive?: boolean }
  ): Promise<BankAccountResponse> {
    const existing = await prisma.bankAccount.findUnique({ where: { id } })
    if (!existing) throw new Error("Bank account not found")

    if (input.isDefault && !existing.isDefault) {
      await prisma.bankAccount.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      })
    }

    const data: Prisma.BankAccountUpdateInput = {}
    if (input.bankCode) data.bankCode = input.bankCode
    if (input.bankName) data.bankName = input.bankName
    if (input.accountName) {
      data.accountName = this.encryption.encryptField(input.accountName)
    }
    if (input.accountNumber) {
      data.accountNumber = this.encryption.encryptField(input.accountNumber)
    }
    if (input.supportedCurrencies) {
      const supportedCurrencies = this.resolveSupportedCurrencies(input)
      data.currency = supportedCurrencies[0]
      data.supportedCurrencies = supportedCurrencies
    } else if (input.currency) {
      data.currency = input.currency
      data.supportedCurrencies = [input.currency]
    }
    if (input.swiftCode !== undefined) data.swiftCode = input.swiftCode
    if (input.bankAddress !== undefined) data.bankAddress = input.bankAddress
    if (input.isDefault !== undefined) data.isDefault = input.isDefault
    if (input.isActive !== undefined) data.isActive = input.isActive

    const account = await prisma.bankAccount.update({
      where: { id },
      data,
    })

    return this.toResponse(account)
  }

  async toggle(id: string): Promise<BankAccountResponse> {
    const account = await prisma.bankAccount.findUnique({ where: { id } })
    if (!account) throw new Error("Bank account not found")

    const updated = await prisma.bankAccount.update({
      where: { id },
      data: { isActive: !account.isActive },
    })

    return this.toResponse(updated)
  }

  async getActiveAccounts(currency?: string): Promise<BankAccountResponse[]> {
    const accounts = await prisma.bankAccount.findMany({
      where: currency
        ? {
            isActive: true,
            OR: [
              { supportedCurrencies: { has: currency } },
              { supportedCurrencies: { isEmpty: true }, currency },
            ],
          }
        : { isActive: true },
      orderBy: [
        { isDefault: "desc" },
        { sortOrder: "asc" },
        { createdAt: "desc" },
      ],
    })
    return accounts.map((account) => this.toResponse(account))
  }

  private resolveSupportedCurrencies(input: {
    currency?: string
    supportedCurrencies?: string[]
  }): string[] {
    const currencies = input.supportedCurrencies?.length
      ? input.supportedCurrencies
      : [input.currency ?? "IDR"]

    return Array.from(
      new Set(
        currencies
          .map((currency) => currency.trim().toUpperCase())
          .filter(Boolean)
      )
    )
  }

  private toResponse(account: {
    id: string
    bankCode: string
    bankName: string
    accountName: string | null
    accountNumber: string | null
    currency: string
    supportedCurrencies?: string[] | null
    swiftCode?: string | null
    bankAddress?: string | null
    isActive: boolean
    isDefault: boolean
  }): BankAccountResponse {
    return {
      id: account.id,
      bankCode: account.bankCode,
      bankName: account.bankName,
      accountName:
        this.encryption.decryptFieldOptional(account.accountName) || "",
      accountNumber:
        this.encryption.decryptFieldOptional(account.accountNumber) || "",
      currency: account.currency,
      supportedCurrencies:
        account.supportedCurrencies && account.supportedCurrencies.length > 0
          ? account.supportedCurrencies
          : [account.currency],
      swiftCode: account.swiftCode ?? null,
      bankAddress: account.bankAddress ?? null,
      isActive: account.isActive,
      isDefault: account.isDefault,
    }
  }
}
