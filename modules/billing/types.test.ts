import { describe, it, expect } from "bun:test"
import { Prisma } from "@prisma/client"
import { TestDecimal } from "@/test/helpers/prisma-mock"
import {
  InsufficientBalanceError,
  NegativeBalanceError,
  PricingNotFoundError,
  BillingAccountNotFoundError,
  SubscriptionNotFoundError,
  InvalidSubscriptionBillingModeError,
  SubscriptionInactiveError,
  CalcPaygOnNonPaygError,
  QuotaExceededError,
  DailyLimitExceededError,
  DeviceNotFoundError,
  OrganizationNotMappedError,
} from "./types"

describe("billing error classes", () => {
  it("InsufficientBalanceError", () => {
    const err = new InsufficientBalanceError(
      new TestDecimal("50000") as unknown as Prisma.Decimal,
      new TestDecimal("30000") as unknown as Prisma.Decimal
    )
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe("InsufficientBalanceError")
    expect(err.message).toContain("50000")
    expect(err.message).toContain("30000")
    expect(err.required.toString()).toBe("50000.00")
    expect(err.available.toString()).toBe("30000.00")
  })

  it("NegativeBalanceError", () => {
    const err = new NegativeBalanceError()
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe("NegativeBalanceError")
    expect(err.message).toContain("negative balance")
  })

  it("PricingNotFoundError", () => {
    const err = new PricingNotFoundError(
      "plan-1", "region-1", "PAYG", "SUBSCRIPTION"
    )
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe("PricingNotFoundError")
    expect(err.message).toContain("plan-1")
  })

  it("BillingAccountNotFoundError", () => {
    const err = new BillingAccountNotFoundError("org-123")
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe("BillingAccountNotFoundError")
    expect(err.message).toContain("org-123")
  })

  it("SubscriptionNotFoundError", () => {
    const err = new SubscriptionNotFoundError("sub-1")
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe("SubscriptionNotFoundError")
    expect(err.message).toContain("sub-1")
  })

  it("InvalidSubscriptionBillingModeError", () => {
    const err = new InvalidSubscriptionBillingModeError(
      "sub-1", "SUBSCRIPTION", "PAYG"
    )
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe("InvalidSubscriptionBillingModeError")
    expect(err.message).toContain("sub-1")
    expect(err.message).toContain("PAYG")
  })

  it("SubscriptionInactiveError", () => {
    const err = new SubscriptionInactiveError("sub-1")
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe("SubscriptionInactiveError")
    expect(err.message).toContain("not ACTIVE")
  })

  it("CalcPaygOnNonPaygError", () => {
    const err = new CalcPaygOnNonPaygError()
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe("CalcPaygOnNonPaygError")
    expect(err.message).toContain("non-PAYG")
  })

  it("QuotaExceededError", () => {
    const err = new QuotaExceededError("org-1", "dev-1", "OUT", 1000, 950)
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe("QuotaExceededError")
    expect(err.message).toContain("org-1")
    expect(err.direction).toBe("OUT")
    expect(err.monthlyLimit).toBe(1000)
    expect(err.monthlyUsed).toBe(950)
  })

  it("DailyLimitExceededError", () => {
    const err = new DailyLimitExceededError("org-1", "dev-1", 100, 95)
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe("DailyLimitExceededError")
    expect(err.message).toContain("org-1")
    expect(err.dailyLimit).toBe(100)
    expect(err.dailyUsed).toBe(95)
  })

  it("DeviceNotFoundError", () => {
    const err = new DeviceNotFoundError("org-1", "dev-1")
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe("DeviceNotFoundError")
    expect(err.message).toContain("org-1")
    expect(err.message).toContain("dev-1")
  })

  it("OrganizationNotMappedError", () => {
    const err = new OrganizationNotMappedError("org-1")
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe("OrganizationNotMappedError")
    expect(err.message).toContain("org-1")
  })
})
