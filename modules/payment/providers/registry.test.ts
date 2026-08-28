import { describe, it, expect, beforeEach } from "bun:test"
import {
  registerProvider,
  deregisterProvider,
  clearProviders,
  getProvider,
  listProviders,
  findProvider,
  getProviderConfigFields,
} from "./registry"
import type { PaymentProvider } from "./provider.interface"

describe("PaymentProviderRegistry", () => {
  const mockProvider1: PaymentProvider = {
    id: "test-provider-1",
    name: "Test Provider 1",
    supportedCurrencies: ["USD", "EUR"],
    paymentMethods: ["CREDIT_CARD", "BANK_TRANSFER"],
    configFields: [
      {
        key: "apiKey",
        type: "password",
        label: "API Key",
        required: true,
      },
    ],
    createPayment: async () => ({ reference: "ref1" }),
    verifyCallback: async () => true,
  }

  const mockProvider2: PaymentProvider = {
    id: "test-provider-2",
    name: "Test Provider 2",
    supportedCurrencies: ["IDR"],
    paymentMethods: ["QR", "VC"],
    configFields: [
      {
        key: "merchantCode",
        type: "string",
        label: "Merchant Code",
        required: true,
      },
    ],
    createPayment: async () => ({ reference: "ref2" }),
    verifyCallback: async () => true,
  }

  beforeEach(() => {
    clearProviders()
  })

  describe("registerProvider", () => {
    it("registers a provider successfully", () => {
      registerProvider(mockProvider1)
      expect(getProvider("test-provider-1")).toBe(mockProvider1)
    })

    it("throws error when registering duplicate provider id", () => {
      registerProvider(mockProvider1)
      expect(() => registerProvider(mockProvider1)).toThrow(
        'Provider "test-provider-1" is already registered'
      )
    })
  })

  describe("deregisterProvider", () => {
    it("removes a registered provider", () => {
      registerProvider(mockProvider1)
      expect(getProvider("test-provider-1")).toBe(mockProvider1)

      deregisterProvider("test-provider-1")
      expect(getProvider("test-provider-1")).toBeUndefined()
    })
  })

  describe("clearProviders", () => {
    it("clears all providers", () => {
      registerProvider(mockProvider1)
      registerProvider(mockProvider2)
      expect(listProviders()).toHaveLength(2)

      clearProviders()
      expect(listProviders()).toHaveLength(0)
    })
  })

  describe("listProviders", () => {
    it("lists all registered providers", () => {
      registerProvider(mockProvider1)
      registerProvider(mockProvider2)

      const list = listProviders()
      expect(list).toHaveLength(2)
      expect(list).toContain(mockProvider1)
      expect(list).toContain(mockProvider2)
    })
  })

  describe("findProvider", () => {
    it("finds matching provider by currency and payment method", () => {
      registerProvider(mockProvider1)
      registerProvider(mockProvider2)

      const found1 = findProvider("USD", "CREDIT_CARD")
      expect(found1).toBe(mockProvider1)

      const found2 = findProvider("IDR", "QR")
      expect(found2).toBe(mockProvider2)
    })

    it("returns undefined if no matching provider is found", () => {
      registerProvider(mockProvider1)

      expect(findProvider("JPY", "CREDIT_CARD")).toBeUndefined()
      expect(findProvider("USD", "QR")).toBeUndefined()
    })
  })

  describe("getProviderConfigFields", () => {
    it("returns config fields for existing provider", () => {
      registerProvider(mockProvider1)

      const fields = getProviderConfigFields("test-provider-1")
      expect(fields).toEqual(mockProvider1.configFields)
    })

    it("returns empty array for non-existing provider", () => {
      const fields = getProviderConfigFields("non-existent")
      expect(fields).toEqual([])
    })
  })
})
