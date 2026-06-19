import "@/test/register"
import { describe, expect, it, beforeEach, mock } from "bun:test"
import { render, waitFor } from "@testing-library/react"
import { BillingAlertsForm } from "./billing-alerts-form"
import React from "react"

// ─── Mock billing client ──────────────────────────────────────────────────────

const mockGetBillingAccount = mock()
const mockUpdateBillingAlerts = mock()

mock.module("@/lib/billing-client", () => ({
  getBillingAccount: mockGetBillingAccount,
  updateBillingAlerts: mockUpdateBillingAlerts,
}))

const defaultAccount = {
  ok: true as const,
  id: "ba_1",
  organizationId: "org_1",
  tenantId: null,
  preferredCurrency: "USD" as const,
  timezone: "UTC",
  status: "ACTIVE",
  balance: 100000,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  contacts: [],
  alertPreferences: {
    balanceThresholdEnabled: false,
    balanceThresholdAmount: 50000,
    usageThresholdEnabled: false,
    usageThresholdAmount: 100000,
  },
}

describe("BillingAlertsForm", () => {
  beforeEach(() => {
    mockGetBillingAccount.mockReset()
    mockUpdateBillingAlerts.mockReset()
    mockGetBillingAccount.mockResolvedValue(defaultAccount)
  })

  it("shows loading state initially", () => {
    mockGetBillingAccount.mockImplementationOnce(
      () => new Promise(() => {}) // never resolves
    )
    const view = render(<BillingAlertsForm />)
    // Loading skeletons should be visible
    const skeletons = view.container.querySelectorAll(
      '[class*="animate-pulse"]'
    )
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it("loads and displays default preferences", async () => {
    const view = render(<BillingAlertsForm />)

    await waitFor(() => {
      const checkbox = view.getByRole("checkbox", {
        name: "Enable low balance alert",
      })
      expect(checkbox.getAttribute("aria-checked")).toBe("false")
    })
  })

  it("loads and displays enabled balance threshold", async () => {
    mockGetBillingAccount.mockResolvedValue({
      ...defaultAccount,
      alertPreferences: {
        balanceThresholdEnabled: true,
        balanceThresholdAmount: 25000,
        usageThresholdEnabled: false,
        usageThresholdAmount: 100000,
      },
    })

    const view = render(<BillingAlertsForm />)

    await waitFor(() => {
      const balanceCheckbox = view.getByRole("checkbox", {
        name: "Enable low balance alert",
      })
      expect(balanceCheckbox.getAttribute("aria-checked")).toBe("true")
    })

    await waitFor(() => {
      expect(view.getByDisplayValue("25000")).toBeTruthy()
    })
  })

  it("shows invoice reminders link to contacts page", async () => {
    const view = render(<BillingAlertsForm />)

    await waitFor(() => {
      const link = view.getByRole("link", { name: /Billing Contacts/i })
      expect(link).toBeTruthy()
      expect(link.getAttribute("href")).toBe("/console/billing/contacts")
    })
  })

  it("handles API error gracefully", async () => {
    mockGetBillingAccount.mockRejectedValue(new Error("Failed to fetch"))

    const view = render(<BillingAlertsForm />)

    await waitFor(() => {
      // Should show retry button
      const retry = view.queryByRole("button", { name: /Retry/i })
      // If the form can show fallback UI, check for it
      expect(retry).toBeTruthy()
    })
  })

  it("has a Save button", async () => {
    const view = render(<BillingAlertsForm />)

    await waitFor(() => {
      const saveButton = view.getByRole("button", { name: /Save Preferences/i })
      expect(saveButton).toBeTruthy()
    })
  })
})
