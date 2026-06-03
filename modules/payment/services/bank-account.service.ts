import { prisma } from "@/lib/prisma"
import { EncryptionService } from "./encryption.service"
import type { BankAccountResponse } from "@/modules/payment/types/payment.types"

export class BankAccountService {
  private encryption: EncryptionService

  constructor(encryption?: EncryptionService) {
    const key = process.env.ENCRYPTION_KEY || ""
    this.encryption = encryption || new EncryptionService(key)
  }

  async list(options: { includeInactive?: boolean } = {}): Promise<BankAccountResponse[]> {
    const where = options.includeInactive ? {} : { isActive: true }
    const accounts = await prisma.bankAccount.findMany({
      where,
      orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    })

    return accounts.map((account) => this.toResponse(account))
  }

  async findById(id: string): Promise<BankAccountResponse | null> {
    const account = await prisma.bankAccount.findUnique({ where: { id } })
    if (!account) return null
    return this.toResponse(account)
  }

  async create(input: {
    bankCode: string
    bankName: string
    accountName: string
    accountNumber: string
    isDefault?: boolean
  }): Promise<BankAccountResponse> {
    if (input.isDefault) {
      await prisma.bankAccount.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      })
    }

    const account = await prisma.bankAccount.create({
      data: {
        bankCode: input.bankCode,
        bankName: input.bankName,
        accountName: this.encryption.encryptField(input.accountName),
        accountNumber: this.encryption.encryptField(input.accountNumber),
        isDefault: input.isDefault || false,
        isActive: true,
      },
    })

    return this.toResponse(account)
  }

  async update(
    id: string,
    input: {
      bankCode?: string
      bankName?: string
      accountName?: string
      accountNumber?: string
      isDefault?: boolean
      isActive?: boolean
    }
  ): Promise<BankAccountResponse> {
    const existing = await prisma.bankAccount.findUnique({ where: { id } })
    if (!existing) throw new Error("Bank account not found")

    if (input.isDefault && !existing.isDefault) {
      await prisma.bankAccount.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      })
    }

    const data: Record<string, unknown> = {}
    if (input.bankCode) data.bankCode = input.bankCode
    if (input.bankName) data.bankName = input.bankName
    if (input.accountName) data.accountName = this.encryption.encryptField(input.accountName)
    if (input.accountNumber) data.accountNumber = this.encryption.encryptField(input.accountNumber)
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

  async getActiveAccounts(): Promise<BankAccountResponse[]> {
    return this.list({ includeInactive: false })
  }

  private toResponse(account: {
    id: string
    bankCode: string
    bankName: string
    accountName: string
    accountNumber: string
    isActive: boolean
    isDefault: boolean
  }): BankAccountResponse {
    return {
      id: account.id,
      bankCode: account.bankCode,
      bankName: account.bankName,
      accountName: this.encryption.decryptFieldOptional(account.accountName) || "",
      accountNumber: this.encryption.decryptFieldOptional(account.accountNumber) || "",
      isActive: account.isActive,
      isDefault: account.isDefault,
    }
  }
}