import "@/test/register"
import { describe, expect, it, beforeEach, afterEach } from "bun:test"
import { render } from "@testing-library/react"
import { BillingAlertsForm } from "./billing-alerts-form"
import React from "react"

const STORAGE_KEY = "notify-limits"
const OLD_STORAGE_KEY = "billing-alert-preferences"

describe("BillingAlertsForm localStorage key and migration", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it("loads default preferences when localStorage is empty", () => {
    const view = render(<BillingAlertsForm />)
    const checkbox = view.getByRole("checkbox", { name: "Enable low balance alert" })
    expect(checkbox.getAttribute("aria-checked")).toBe("false")
  })

  it("loads preferences from notify-limits if present", () => {
    const preferences = {
      balanceThresholdEnabled: true,
      balanceThresholdAmount: 25000,
      usageThresholdEnabled: false,
      usageThresholdAmount: 100000,
      invoiceReminderEnabled: true,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))

    const view = render(<BillingAlertsForm />)

    const balanceCheckbox = view.getByRole("checkbox", { name: "Enable low balance alert" })
    expect(balanceCheckbox.getAttribute("aria-checked")).toBe("true")

    const invoiceCheckbox = view.getByRole("checkbox", { name: "Send email when new invoice is issued" })
    expect(invoiceCheckbox.getAttribute("aria-checked")).toBe("true")
  })

  it("migrates preferences from billing-alert-preferences to notify-limits", () => {
    const legacyPreferences = {
      balanceThresholdEnabled: true,
      balanceThresholdAmount: 15000,
      usageThresholdEnabled: true,
      usageThresholdAmount: 75000,
      invoiceReminderEnabled: false,
    }
    localStorage.setItem(OLD_STORAGE_KEY, JSON.stringify(legacyPreferences))

    const view = render(<BillingAlertsForm />)

    // Check that values are loaded in form
    const balanceCheckbox = view.getByRole("checkbox", { name: "Enable low balance alert" })
    expect(balanceCheckbox.getAttribute("aria-checked")).toBe("true")

    // Check that new key is set and old key is removed
    const newStored = localStorage.getItem(STORAGE_KEY)
    expect(newStored).not.toBeNull()
    expect(JSON.parse(newStored!)).toEqual(legacyPreferences)

    const oldStored = localStorage.getItem(OLD_STORAGE_KEY)
    expect(oldStored).toBeNull()
  })

  it("handles malformed legacy JSON gracefully", () => {
    localStorage.setItem(OLD_STORAGE_KEY, "{ invalid json }")
    const view = render(<BillingAlertsForm />)
    const checkbox = view.getByRole("checkbox", { name: "Enable low balance alert" })
    expect(checkbox.getAttribute("aria-checked")).toBe("false")
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(OLD_STORAGE_KEY)).toBeNull()
  })

  it("handles malformed new JSON gracefully", () => {
    localStorage.setItem(STORAGE_KEY, "{ invalid json }")
    const view = render(<BillingAlertsForm />)
    const checkbox = view.getByRole("checkbox", { name: "Enable low balance alert" })
    expect(checkbox.getAttribute("aria-checked")).toBe("false")
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
