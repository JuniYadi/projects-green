import { describe, expect, it } from "bun:test"

import { EncryptionService } from "../services/encryption.service"
import { toPaymentConfirmationDTO } from "./payment-confirmation.dto"

const ENCRYPTION_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

describe("toPaymentConfirmationDTO", () => {
  it("decrypts bank account fields before returning the API response", () => {
    process.env.ENCRYPTION_KEY = ENCRYPTION_KEY
    const encryption = new EncryptionService(ENCRYPTION_KEY)

    const dto = toPaymentConfirmationDTO({
      id: "pc-1",
      amount: 50382,
      bankAccountId: "ba-1",
      status: "PENDING",
      createdAt: new Date("2026-06-11T00:00:00.000Z"),
      notes: null,
      invoice: { currency: "USD" },
      bankAccount: {
        currency: "USD",
        bankName: "Bank JP Morgan",
        accountName: encryption.encryptField("PT Projects Green"),
        accountNumber: encryption.encryptField("1234567890"),
      },
    } as never)

    expect(dto.bankName).toBe("Bank JP Morgan")
    expect(dto.accountName).toBe("PT Projects Green")
    expect(dto.accountNumber).toBe("1234567890")
    expect(dto.accountNumber).not.toContain("encrypted")
  })
})
