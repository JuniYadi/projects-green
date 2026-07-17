/**
 * Payment Seeder (System)
 *
 * Seeds the Duitku payment gateway and supported bank accounts
 * (BCA, Mandiri, BRI, BNI) for manual bank transfer.
 *
 * Duitku gateway config is managed via the portal UI at `/portal/billing/payments?tab=gateways`.
 * This seeder only provides placeholder defaults that get overwritten through the UI.
 */

import { BaseSeeder, registerSeeder } from "@/lib/seeders"

// ─── Seed Data ────────────────────────────────────────────────────────────────

interface BankAccountSeed {
  bankCode: string
  bankName: string
  accountName: string
  accountNumber: string
  currency: string
  supportedCurrencies: string[]
  swiftCode: string | null
  bankAddress: string | null
  isDefault: boolean
  sortOrder: number
}

const bankAccounts: BankAccountSeed[] = [
  {
    bankCode: "BCA",
    bankName: "Bank Central Asia",
    accountName: "PT Projects Green Technology",
    accountNumber: "1234567890",
    currency: "IDR",
    supportedCurrencies: ["IDR"],
    swiftCode: "CENAIDJA",
    bankAddress: "Jl. MH Thamrin No. 1, Jakarta Pusat 10310",
    isDefault: true,
    sortOrder: 0,
  },
  {
    bankCode: "MANDIRI",
    bankName: "Bank Mandiri",
    accountName: "PT Projects Green Technology",
    accountNumber: "1234567890123",
    currency: "IDR",
    supportedCurrencies: ["IDR"],
    swiftCode: "BMRIIDJA",
    bankAddress: "Jl. Jenderal Gatot Subroto Kav. 36-38, Jakarta Selatan 12190",
    isDefault: false,
    sortOrder: 10,
  },
  {
    bankCode: "BRI",
    bankName: "Bank Rakyat Indonesia",
    accountName: "PT Projects Green Technology",
    accountNumber: "123456789012345",
    currency: "IDR",
    supportedCurrencies: ["IDR"],
    swiftCode: "BRINIDJA",
    bankAddress: "Jl. Jenderal Sudirman No. 44-46, Jakarta Pusat 10210",
    isDefault: false,
    sortOrder: 20,
  },
  {
    bankCode: "BNI",
    bankName: "Bank Negara Indonesia",
    accountName: "PT Projects Green Technology",
    accountNumber: "1234567890",
    currency: "IDR",
    supportedCurrencies: ["IDR", "USD"],
    swiftCode: "BNINIDJA",
    bankAddress: "Jl. Jenderal Sudirman Kav. 1, Jakarta Pusat 10220",
    isDefault: false,
    sortOrder: 30,
  },
]

// ─── Seeder Class ─────────────────────────────────────────────────────────────

export class PaymentSeeder extends BaseSeeder {
  static override readonly seederName = "Payment"
  static override readonly classification = "system" as const
  static override readonly runOrder = 15
  static override readonly description =
    "Duitku payment gateway and bank accounts (BCA, Mandiri, BRI, BNI)"

  async seed(): Promise<void> {
    await this.seedDuitkuGateway()
    await this.seedBankAccounts()
  }

  private async seedDuitkuGateway(): Promise<void> {
    this.log("Seeding Duitku payment gateway...")

    const config = {
      merchantCode: process.env.DUITKU_MERCHANT_CODE ?? "DS00000",
      apiKey: process.env.DUITKU_API_KEY ?? "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      sandboxUrl:
        process.env.DUITKU_SANDBOX_URL ??
        "https://sandbox.duitku.com/webapi/api/merchant",
      productionUrl:
        process.env.DUITKU_PRODUCTION_URL ??
        "https://passport.duitku.com/webapi/api/merchant",
    }

    const existing = await this.prisma.paymentGateway.findFirst({
      where: { name: "Duitku" },
    })

    if (existing) {
      await this.prisma.paymentGateway.update({
        where: { id: existing.id },
        data: {
          type: "GATEWAY",
          config,
          supportedCurrencies: ["IDR"],
          isActive: true,
          isDefault: true,
          sortOrder: 0,
        },
      })
      this.trackUpdated()
      this.log("Updated Duitku gateway")
    } else {
      await this.prisma.paymentGateway.create({
        data: {
          name: "Duitku",
          type: "GATEWAY",
          config,
          supportedCurrencies: ["IDR"],
          isActive: true,
          isDefault: true,
          sortOrder: 0,
        },
      })
      this.trackCreated()
      this.log("Created Duitku gateway")
    }

    // Also create a BANK_TRANSFER gateway if it doesn't exist
    const bankTransferExisting = await this.prisma.paymentGateway.findFirst({
      where: { name: "Manual Bank Transfer" },
    })

    if (bankTransferExisting) {
      await this.prisma.paymentGateway.update({
        where: { id: bankTransferExisting.id },
        data: {
          type: "BANK_TRANSFER",
          config: {},
          supportedCurrencies: ["IDR", "USD"],
          isActive: true,
          isDefault: false,
          sortOrder: 10,
        },
      })
      this.trackUpdated()
    } else {
      await this.prisma.paymentGateway.create({
        data: {
          name: "Manual Bank Transfer",
          type: "BANK_TRANSFER",
          config: {},
          supportedCurrencies: ["IDR", "USD"],
          isActive: true,
          isDefault: false,
          sortOrder: 10,
        },
      })
      this.trackCreated()
    }
  }

  private async seedBankAccounts(): Promise<void> {
    this.log("Seeding bank accounts...")

    const bankTransferGateway = await this.prisma.paymentGateway.findFirst({
      where: { type: "BANK_TRANSFER" },
    })

    for (const account of bankAccounts) {
      const existing = await this.prisma.paymentBankAccount.findFirst({
        where: { bankCode: account.bankCode },
      })

      const data = {
        gatewayId: bankTransferGateway?.id ?? null,
        bankCode: account.bankCode,
        bankName: account.bankName,
        accountName: account.accountName,
        accountNumber: account.accountNumber,
        currency: account.currency,
        supportedCurrencies: account.supportedCurrencies,
        swiftCode: account.swiftCode,
        bankAddress: account.bankAddress,
        isActive: true,
        isDefault: account.isDefault,
        sortOrder: account.sortOrder,
      }

      if (existing) {
        await this.prisma.paymentBankAccount.update({
          where: { id: existing.id },
          data,
        })
        this.trackUpdated()
      } else {
        await this.prisma.paymentBankAccount.create({ data })
        this.trackCreated()
      }
    }
  }

  async unseed(): Promise<void> {
    this.log("Removing seeded payment data...")

    await this.prisma.$transaction(async (tx) => {
      const deletedBankAccounts = await tx.paymentBankAccount.deleteMany({
        where: {
          bankCode: { in: bankAccounts.map((a) => a.bankCode) },
        },
      })
      this.trackDeleted(deletedBankAccounts.count)

      const manualGateway = await tx.paymentGateway.findFirst({
        where: { name: "Manual Bank Transfer" },
      })
      if (manualGateway) {
        await tx.paymentGateway.delete({
          where: { id: manualGateway.id },
        })
        this.trackDeleted(1)
      }

      const duitkuGateway = await tx.paymentGateway.findFirst({
        where: { name: "Duitku" },
      })
      if (duitkuGateway) {
        await tx.paymentGateway.delete({
          where: { id: duitkuGateway.id },
        })
        this.trackDeleted(1)
      }
    })

    this.log(`Done: ${this.result.deleted} records removed`)
  }
}

registerSeeder(PaymentSeeder)
