import "@/test/register"
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { render, waitFor } from "@testing-library/react"

import { BillingContactsList } from "./billing-contacts-list"

const originalFetch = globalThis.fetch

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })

const ownerContact = {
  id: "contact_owner",
  billingAccountId: "ba_1",
  email: "owner@example.com",
  name: "Organization Owner",
  role: "OWNER",
  notifyOnInvoice: true,
  notifyOnLowBalance: true,
  notifyOnSupport: true,
  isActive: true,
  createdAt: "2026-07-22T00:00:00.000Z",
  updatedAt: "2026-07-22T00:00:00.000Z",
}

const financeContact = {
  ...ownerContact,
  id: "contact_finance",
  email: "finance@example.com",
  name: "Finance Team",
  role: "FINANCE" as const,
}

const accountPayload = (contacts: unknown[]) => ({
  ok: true as const,
  id: "ba_1",
  organizationId: "org_1",
  currency: "IDR",
  preferredCurrency: "IDR",
  timezone: "UTC",
  status: "ACTIVE",
  balance: "0",
  contacts,
})

describe("BillingContactsList — OWNER first-time hint", () => {
  beforeEach(() => {
    globalThis.fetch = mock(async () =>
      jsonResponse(accountPayload([ownerContact]))
    ) as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("shows the one-time OWNER hint when only the seeded OWNER contact exists", async () => {
    const view = render(<BillingContactsList />)

    await waitFor(() =>
      expect(
        view.getByText(/been added as the OWNER contact/i)
      ).toBeInTheDocument()
    )
    expect(
      view.getByText(/billing notifications never get lost/i)
    ).toBeInTheDocument()
  })

  it("hides the hint when finance contacts are added", async () => {
    globalThis.fetch = mock(async () =>
      jsonResponse(accountPayload([ownerContact, financeContact]))
    ) as unknown as typeof fetch

    const view = render(<BillingContactsList />)

    await waitFor(() =>
      expect(view.getByText("owner@example.com")).toBeInTheDocument()
    )
    expect(
      view.queryByText(/been added as the OWNER contact/i)
    ).not.toBeInTheDocument()
  })

  it("hides the hint when the OWNER contact is the only row but inactive", async () => {
    globalThis.fetch = mock(async () =>
      jsonResponse(accountPayload([{ ...ownerContact, isActive: false }]))
    ) as unknown as typeof fetch

    const view = render(<BillingContactsList />)

    await waitFor(() =>
      expect(view.getByText("owner@example.com")).toBeInTheDocument()
    )
    expect(
      view.queryByText(/You've been added as the OWNER contact/i)
    ).not.toBeInTheDocument()
  })
})
